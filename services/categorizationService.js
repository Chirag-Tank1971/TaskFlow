const crypto = require("crypto");
const { getGeminiClient, PRIMARY_MODEL, getModelStatus } = require("./geminiClient");
// All Gemini calls go through geminiGenerate: shared rate limit, retries, per-model quota fallback
const { generateContent, AiBusyError } = require("./geminiGenerate");
const { generationLimiter } = require("./geminiRateLimiter");

// Category definitions
const CATEGORIES = ["Support", "Sales", "Technical", "Billing", "Urgent", "General"];

// In-memory cache for categorization results
// In production, consider using Redis for distributed caching
const categorizationCache = new Map();
const CACHE_TTL = 24 * 60 * 60 * 1000; // 24 hours in milliseconds

// Last model that successfully answered (for health stats)
let workingModel = null;

// Health monitoring
const healthStats = {
  totalRequests: 0,
  successfulRequests: 0,
  failedRequests: 0,
  cacheHits: 0,
  lastSuccessTime: null,
  lastFailureTime: null,
  consecutiveFailures: 0,
  isHealthy: true
};

/**
 * Generate cache key from task notes
 */
const generateCacheKey = (notes) => {
  if (!notes || typeof notes !== "string") return null;
  // Normalize the notes (lowercase, trim) for better cache hits
  const normalized = notes.toLowerCase().trim();
  return crypto.createHash("md5").update(normalized).digest("hex");
};

/**
 * Check if cached result is still valid
 */
const isCacheValid = (cachedItem) => {
  if (!cachedItem) return false;
  return Date.now() - cachedItem.timestamp < CACHE_TTL;
};

/**
 * True if the shared per-minute budget has room (does not consume it)
 */
const checkRateLimit = () => generationLimiter.check();

/**
 * The configured model. No probe requests are made: they cost scarce free-tier quota,
 * and generateContent already falls back to other models when one is unavailable.
 * Kept async and under the old names for existing callers.
 */
const getWorkingModel = async () => PRIMARY_MODEL;
const discoverWorkingModel = async () => PRIMARY_MODEL;

/** Wrap quota errors the way the batch code expects (err.isRateLimit). */
const toRateLimitError = (err) => {
  const e = new Error(err.message || "Rate limit exceeded");
  e.isRateLimit = true;
  e.originalError = err;
  return e;
};

/**
 * Categorize a single task using Gemini API
 * @param {string} taskNotes - The task notes to categorize
 * @param {boolean} useCache - Whether to use cache (default: true)
 * @returns {Promise<{category: string, source: string, confidence: number|null}>}
 */
const categorizeTask = async (taskNotes, useCache = true) => {
  healthStats.totalRequests++;
  
  // Input validation
  if (!taskNotes || typeof taskNotes !== "string" || taskNotes.trim().length === 0) {
    return {
      category: "General",
      source: "default",
      confidence: null
    };
  }

  const trimmedNotes = taskNotes.trim();

  // Check cache first
  if (useCache) {
    const cacheKey = generateCacheKey(trimmedNotes);
    if (cacheKey) {
      const cached = categorizationCache.get(cacheKey);
      if (isCacheValid(cached)) {
        healthStats.cacheHits++;
        if (process.env.NODE_ENV !== "production") {
          console.log(`[Categorization] Cache hit for task notes`);
        }
        return {
          category: cached.category,
          source: "ai",
          confidence: cached.confidence
        };
      }
    }
  }

  // Check if AI categorization is enabled
  const aiEnabled = process.env.ENABLE_AI_CATEGORIZATION !== "false";
  if (!aiEnabled) {
    if (process.env.NODE_ENV !== "production") {
      console.log(`[Categorization] AI disabled, using default category`);
    }
    return {
      category: "General",
      source: "default",
      confidence: null
    };
  }

  // Check rate limit
  if (!checkRateLimit()) {
    healthStats.failedRequests++;
    healthStats.lastFailureTime = Date.now();
    console.warn(`[Categorization] Rate limit exceeded, using default category`);
    return {
      category: "General",
      source: "default",
      confidence: null
    };
  }

  try {
    const prompt = `Analyze this task note and categorize it into EXACTLY ONE of these categories: Support, Sales, Technical, Billing, Urgent, or General.

Task note: "${trimmedNotes}"

Rules:
- "Support" = Customer support, help requests, service issues
- "Sales" = Sales inquiries, leads, purchase questions, product inquiries
- "Technical" = Technical issues, bugs, system problems, IT support
- "Billing" = Payment issues, invoices, refunds, billing questions
- "Urgent" = Time-sensitive, critical, emergency situations
- "General" = Everything else, unclear, or doesn't fit other categories

Respond with ONLY the category name, nothing else. No explanations, no additional text.`;

    // Retries, overload handling and fallback models are handled by generateContent
    const { response, model } = await generateContent({ contents: prompt });
    workingModel = model;

    // Validate and normalize category
    const normalizedText = (response.text || "").toLowerCase().trim();
    const category = CATEGORIES.find((cat) => normalizedText.includes(cat.toLowerCase())) || "General";

    // Cache the result
    const cacheKey = generateCacheKey(trimmedNotes);
    if (cacheKey) {
      categorizationCache.set(cacheKey, {
        category,
        confidence: null, // Gemini doesn't provide confidence scores
        timestamp: Date.now()
      });

      // Clean old cache entries periodically (keep cache size manageable)
      if (categorizationCache.size > 1000) {
        const entries = Array.from(categorizationCache.entries());
        entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
        // Remove oldest 200 entries
        for (let i = 0; i < 200; i++) {
          categorizationCache.delete(entries[i][0]);
        }
      }
    }

    // Success - update health stats
    healthStats.successfulRequests++;
    healthStats.lastSuccessTime = Date.now();
    healthStats.consecutiveFailures = 0;
    healthStats.isHealthy = true;

    if (process.env.NODE_ENV !== "production") {
      console.log(`[Categorization] Successfully categorized as: ${category} (model: ${model})`);
    }

    return {
      category,
      source: "ai",
      confidence: null
    };
  } catch (error) {
    // Update health stats
    healthStats.failedRequests++;
    healthStats.lastFailureTime = Date.now();
    healthStats.consecutiveFailures++;
    if (healthStats.consecutiveFailures >= 5) healthStats.isHealthy = false;

    // Quota exhausted on every model: let batch callers stop early
    if (error instanceof AiBusyError) {
      console.warn(`[Categorization] ${error.message}`);
      throw toRateLimitError(error);
    }

    console.error(`[Categorization] Error categorizing task: ${error.message}`);

    // For other errors, return default category gracefully
    return {
      category: "General",
      source: "default",
      confidence: null
    };
  }
};

/**
 * Separate tasks into cached and uncached
 * @param {Array<{notes: string}>} tasks - Array of tasks
 * @returns {Promise<{cachedResults: Array, uncachedTasks: Array}>}
 */
const separateCachedTasks = async (tasks) => {
  const cachedResults = [];
  const uncachedTasks = [];
  
  for (let i = 0; i < tasks.length; i++) {
    const task = tasks[i];
    const notes = task.notes || "";
    const cacheKey = generateCacheKey(notes);
    
    if (cacheKey) {
      const cached = categorizationCache.get(cacheKey);
      if (isCacheValid(cached)) {
        healthStats.cacheHits++;
        cachedResults.push({
          index: i,
          result: {
            category: cached.category,
            source: "ai",
            confidence: cached.confidence
          }
        });
        continue;
      }
    }
    
    uncachedTasks.push({
      index: i,
      task: task
    });
  }
  
  return { cachedResults, uncachedTasks };
};

/**
 * Estimate token count for text (rough approximation: 1 token ≈ 0.75 words)
 * @param {string} text - Text to estimate
 * @returns {number} - Estimated token count
 */
const estimateTokens = (text) => {
  if (!text || typeof text !== "string") return 0;
  const words = text.trim().split(/\s+/).length;
  return Math.ceil(words / 0.75);
};

/**
 * Create optimal chunks from tasks
 * @param {Array<{index: number, task: Object}>} tasks - Array of tasks with indices
 * @param {Object} config - Chunking configuration
 * @returns {Array<Array<{index: number, task: Object}>>} - Array of chunks
 */
const createOptimalChunks = (tasks, config = {}) => {
  const {
    maxChunkSize = 15,
    maxTokens = 2000,
    minChunkSize = 5
  } = config;
  
  if (tasks.length === 0) return [];
  
  const chunks = [];
  let currentChunk = [];
  let currentTokens = 0;
  
  // Base prompt tokens (overhead)
  const basePromptTokens = 200;
  
  for (const item of tasks) {
    const taskNotes = item.task.notes || "";
    const taskTokens = estimateTokens(taskNotes);
    const taskNumberTokens = 10; // For numbering in prompt
    const totalTaskTokens = taskTokens + taskNumberTokens;
    
    // Check if adding this task would exceed limits
    const wouldExceedSize = currentChunk.length >= maxChunkSize;
    const wouldExceedTokens = (currentTokens + totalTaskTokens + basePromptTokens) > maxTokens;
    
    if (wouldExceedSize || wouldExceedTokens) {
      // Start new chunk if current chunk meets minimum size
      if (currentChunk.length >= minChunkSize) {
        chunks.push(currentChunk);
        currentChunk = [item];
        currentTokens = totalTaskTokens;
      } else {
        // Add to current chunk even if it exceeds (better than tiny chunks)
        currentChunk.push(item);
        currentTokens += totalTaskTokens;
      }
    } else {
      currentChunk.push(item);
      currentTokens += totalTaskTokens;
    }
  }
  
  // Add remaining chunk
  if (currentChunk.length > 0) {
    chunks.push(currentChunk);
  }
  
  return chunks;
};

/**
 * Build batch prompt for chunk categorization
 * @param {Array<{index: number, task: Object}>} chunk - Chunk of tasks
 * @returns {string} - Formatted prompt
 */
const buildBatchPrompt = (chunk) => {
  const taskList = chunk.map((item, idx) => {
    const taskNumber = idx + 1;
    const notes = (item.task.notes || "").trim();
    return `${taskNumber}. "${notes}"`;
  }).join('\n');
  
  return `Analyze these tasks and categorize each into EXACTLY ONE category: Support, Sales, Technical, Billing, Urgent, or General.

Tasks:
${taskList}

Rules:
- "Support" = Customer support, help requests, service issues
- "Sales" = Sales inquiries, leads, purchase questions, product inquiries
- "Technical" = Technical issues, bugs, system problems, IT support
- "Billing" = Payment issues, invoices, refunds, billing questions
- "Urgent" = Time-sensitive, critical, emergency situations
- "General" = Everything else, unclear, or doesn't fit other categories

Respond with ONLY a valid JSON array in this exact format:
[
  {"taskNumber": 1, "category": "Support"},
  {"taskNumber": 2, "category": "Sales"},
  ...
]

Do not include any other text, explanations, markdown formatting, or code blocks. Only the JSON array.`;
};

/**
 * Parse batch response from LLM
 * @param {string} responseText - Raw response text
 * @param {number} expectedCount - Expected number of results
 * @returns {Array<{taskNumber: number, category: string}>|null} - Parsed results or null
 */
const parseBatchResponse = (responseText, expectedCount) => {
  if (!responseText || typeof responseText !== "string") {
    return null;
  }
  
  try {
    // Clean response text
    let jsonText = responseText.trim();
    
    // Remove markdown code blocks if present
    jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
    jsonText = jsonText.replace(/^\[/, '[').replace(/\]$/, ']');
    
    // Try to extract JSON array
    const jsonMatch = jsonText.match(/\[[\s\S]*\]/);
    if (jsonMatch) {
      jsonText = jsonMatch[0];
    }
    
    const parsed = JSON.parse(jsonText);
    
    // Validate it's an array
    if (!Array.isArray(parsed)) {
      console.warn(`[Categorization] Batch response is not an array: ${typeof parsed}`);
      return null;
    }
    
    // Validate count (allow some flexibility)
    if (parsed.length !== expectedCount && parsed.length < expectedCount * 0.8) {
      console.warn(`[Categorization] Batch response count mismatch: expected ${expectedCount}, got ${parsed.length}`);
      // Still return partial results
    }
    
    // Validate structure
    const validResults = parsed.filter(item => 
      item && 
      typeof item === 'object' && 
      typeof item.taskNumber === 'number' && 
      typeof item.category === 'string'
    );
    
    if (validResults.length === 0) {
      return null;
    }
    
    return validResults;
  } catch (error) {
    console.error(`[Categorization] Failed to parse batch response: ${error.message}`);
    return null;
  }
};

/**
 * Validate and normalize category
 * @param {string} category - Category from LLM
 * @returns {string} - Valid category
 */
const validateCategory = (category) => {
  if (!category || typeof category !== "string") {
    return "General";
  }
  
  const normalized = category.trim();
  const normalizedLower = normalized.toLowerCase();
  
  // Direct match
  for (const cat of CATEGORIES) {
    if (normalizedLower === cat.toLowerCase()) {
      return cat;
    }
  }
  
  // Partial match
  for (const cat of CATEGORIES) {
    if (normalizedLower.includes(cat.toLowerCase()) || cat.toLowerCase().includes(normalizedLower)) {
      return cat;
    }
  }
  
  return "General";
};

/**
 * Categorize a chunk of tasks in a single batch request
 * @param {Array<{index: number, task: Object}>} chunk - Chunk of tasks
 * @returns {Promise<Array<{index: number, result: Object}>>} - Categorized results
 */
const categorizeChunkBatch = async (chunk) => {
  if (!chunk || chunk.length === 0) {
    return [];
  }
  
  // Check the shared budget before building the prompt (generateContent also enforces it)
  if (!checkRateLimit()) {
    throw toRateLimitError(new Error("Rate limit exceeded"));
  }
  
  const prompt = buildBatchPrompt(chunk);
  
  // Retries, overload handling and fallback models are handled by generateContent
  let response;
  try {
    ({ response } = await generateContent({ contents: prompt }));
  } catch (err) {
    throw err instanceof AiBusyError ? toRateLimitError(err) : err;
  }
  const text = (response.text || "").trim();
  
  // Parse response
  const parsedResults = parseBatchResponse(text, chunk.length);
  
  if (!parsedResults || parsedResults.length === 0) {
    throw new Error("Failed to parse batch response");
  }
  
  // Map parsed results to chunk indices
  const results = [];
  const parsedMap = new Map();
  
  // Create map of taskNumber -> category
  for (const item of parsedResults) {
    parsedMap.set(item.taskNumber, validateCategory(item.category));
  }
  
  // Map to original chunk indices
  for (let i = 0; i < chunk.length; i++) {
    const item = chunk[i];
    const taskNumber = i + 1;
    const category = parsedMap.get(taskNumber) || "General";
    
    // Cache the result
    const notes = item.task.notes || "";
    const cacheKey = generateCacheKey(notes);
    if (cacheKey) {
      categorizationCache.set(cacheKey, {
        category,
        confidence: null,
        timestamp: Date.now()
      });
    }
    
    results.push({
      index: item.index,
      result: {
        category,
        source: "ai",
        confidence: null
      }
    });
  }
  
  // Update health stats
  healthStats.successfulRequests += chunk.length;
  healthStats.lastSuccessTime = Date.now();
  healthStats.consecutiveFailures = 0;
  healthStats.isHealthy = true;
  
  return results;
};

/**
 * Categorize a chunk of tasks individually (fallback)
 * @param {Array<{index: number, task: Object}>} chunk - Chunk of tasks
 * @param {Function} progressCallback - Progress callback
 * @returns {Promise<Array<{index: number, result: Object}>>} - Categorized results
 */
const categorizeChunkIndividually = async (chunk, progressCallback = null) => {
  const results = [];
  
  for (let i = 0; i < chunk.length; i++) {
    const item = chunk[i];
    
    try {
      const result = await categorizeTask(item.task.notes || "", true);
      results.push({
        index: item.index,
        result
      });
      
      // Update progress
      if (progressCallback) {
        progressCallback({
          step: 'categorizing',
          currentStep: `Processing task ${i + 1}/${chunk.length} individually...`,
          processedTasks: results.length,
          totalTasks: chunk.length
        });
      }
      
      // Small delay between individual requests
      if (i < chunk.length - 1) {
        await new Promise(resolve => setTimeout(resolve, 2000));
      }
    } catch (error) {
      // Use default category on error
      results.push({
        index: item.index,
        result: {
          category: "General",
          source: "default",
          confidence: null
        }
      });
    }
  }
  
  return results;
};

/**
 * Combine cached and batch results in correct order
 * @param {Array} cachedResults - Cached results with indices
 * @param {Array} batchResults - Batch results with indices
 * @param {Array} originalTasks - Original tasks array
 * @returns {Array} - Combined results in original order
 */
const combineResults = (cachedResults, batchResults, originalTasks) => {
  // Create map of index -> result
  const resultMap = new Map();
  
  // Add cached results
  for (const item of cachedResults) {
    resultMap.set(item.index, item.result);
  }
  
  // Add batch results
  for (const item of batchResults) {
    resultMap.set(item.index, item.result);
  }
  
  // Build final array in original order
  const results = [];
  let categorizedCount = 0;
  let defaultCount = 0;
  
  for (let i = 0; i < originalTasks.length; i++) {
    const result = resultMap.get(i) || {
      category: "General",
      source: "default",
      confidence: null
    };
    
    results.push(result);
    
    if (result.source === "ai") {
      categorizedCount++;
    } else {
      defaultCount++;
    }
  }
  
  return {
    results,
    categorizedCount,
    defaultCount
  };
};

/**
 * Categorize multiple tasks in batch (Smart Chunked Batching)
 * @param {Array<{notes: string}>} tasks - Array of tasks with notes
 * @param {Function} progressCallback - Optional callback for progress updates (progress, processed, total, step)
 * @returns {Promise<{results: Array, rateLimitHit: boolean, categorizedCount: number, defaultCount: number}>}
 */
const categorizeTasksBatch = async (tasks, progressCallback = null) => {
  if (!Array.isArray(tasks) || tasks.length === 0) {
    return { results: [], rateLimitHit: false, categorizedCount: 0, defaultCount: 0 };
  }

  // Check if AI categorization is enabled
  const aiEnabled = process.env.ENABLE_AI_CATEGORIZATION !== "false";
  if (!aiEnabled) {
    const defaultResults = tasks.map(() => ({
      category: "General",
      source: "default",
      confidence: null
    }));
    return {
      results: defaultResults,
      rateLimitHit: false,
      categorizedCount: 0,
      defaultCount: tasks.length
    };
  }

  let rateLimitHit = false;
  
  try {
    // Step 1: Separate cached vs uncached tasks
    const { cachedResults, uncachedTasks } = await separateCachedTasks(tasks);
    
    console.log(`[Categorization] Found ${cachedResults.length} cached, ${uncachedTasks.length} uncached tasks`);
    
    // Update progress: cache check complete
    if (progressCallback) {
      progressCallback({
        step: 'categorizing',
        currentStep: `Found ${cachedResults.length} cached, categorizing ${uncachedTasks.length} new tasks...`,
        processedTasks: cachedResults.length,
        totalTasks: tasks.length,
        categorizedTasks: cachedResults.length
      });
    }
    
    // If all tasks are cached, return immediately
    if (uncachedTasks.length === 0) {
      const combined = combineResults(cachedResults, [], tasks);
      return {
        results: combined.results,
        rateLimitHit: false,
        categorizedCount: combined.categorizedCount,
        defaultCount: combined.defaultCount
      };
    }
    
    // Step 2: Create optimal chunks
    const chunks = createOptimalChunks(uncachedTasks, {
      maxChunkSize: 15,
      maxTokens: 2000,
      minChunkSize: 5
    });
    
    console.log(`[Categorization] Processing ${uncachedTasks.length} tasks in ${chunks.length} chunks`);
    
    // Step 3: Process chunks with fallback
    const batchResults = [];
    const DELAY_BETWEEN_CHUNKS = 13000; // 13 seconds between chunks (to stay under 5/min)
    
    for (let i = 0; i < chunks.length; i++) {
      const chunk = chunks[i];
      const chunkNumber = i + 1;
      
      // Check rate limit before processing chunk
      if (!checkRateLimit()) {
        rateLimitHit = true;
        console.warn(`[Categorization] Rate limit reached at chunk ${chunkNumber}/${chunks.length}`);
        
        if (progressCallback) {
          progressCallback({
            step: 'categorizing',
            currentStep: 'Rate limit reached. Setting remaining tasks to default...',
            processedTasks: cachedResults.length + batchResults.length,
            totalTasks: tasks.length,
            rateLimitHit: true
          });
        }
        
        // Set remaining chunks to default
        for (let j = i; j < chunks.length; j++) {
          const remainingChunk = chunks[j];
          for (const item of remainingChunk) {
            batchResults.push({
              index: item.index,
              result: {
                category: "General",
                source: "default",
                confidence: null
              }
            });
          }
        }
        break;
      }
      
      // Update progress: starting chunk
      if (progressCallback) {
        progressCallback({
          step: 'categorizing',
          currentStep: `Processing chunk ${chunkNumber}/${chunks.length} (${chunk.length} tasks)...`,
          processedTasks: cachedResults.length + batchResults.length,
          totalTasks: tasks.length,
          categorizedTasks: cachedResults.length + batchResults.filter(r => r.result.source === 'ai').length
        });
      }
      
      try {
        // Try batch categorization
        const chunkResults = await categorizeChunkBatch(chunk);
        batchResults.push(...chunkResults);
        
        console.log(`[Categorization] ✓ Chunk ${chunkNumber}/${chunks.length} categorized successfully`);
        
        // Update progress: chunk complete
        if (progressCallback) {
          progressCallback({
            step: 'categorizing',
            currentStep: `Chunk ${chunkNumber}/${chunks.length} complete`,
            processedTasks: cachedResults.length + batchResults.length,
            totalTasks: tasks.length,
            categorizedTasks: cachedResults.length + batchResults.filter(r => r.result.source === 'ai').length
          });
        }
        
      } catch (error) {
        // Check if it's a rate limit error
        const isRateLimit = error.isRateLimit || 
                           error.message?.includes("Rate limit") || 
                           error.message?.includes("quota") ||
                           error.message?.includes("429") ||
                           error.message?.includes("RESOURCE_EXHAUSTED");
        
        if (isRateLimit) {
          rateLimitHit = true;
          console.warn(`[Categorization] Rate limit hit during chunk ${chunkNumber}, setting remaining to default`);
          
          // Set remaining chunks to default
          for (let j = i; j < chunks.length; j++) {
            const remainingChunk = chunks[j];
            for (const item of remainingChunk) {
              batchResults.push({
                index: item.index,
                result: {
                  category: "General",
                  source: "default",
                  confidence: null
                }
              });
            }
          }
          break;
        }
        
        // Fallback: process chunk individually
        console.warn(`[Categorization] Chunk ${chunkNumber} batch failed, using individual: ${error.message}`);
        
        try {
          const individualResults = await categorizeChunkIndividually(chunk, progressCallback);
          batchResults.push(...individualResults);
        } catch (individualError) {
          // Even individual failed, use defaults
          console.error(`[Categorization] Individual categorization also failed for chunk ${chunkNumber}`);
          for (const item of chunk) {
            batchResults.push({
              index: item.index,
              result: {
                category: "General",
                source: "default",
                confidence: null
              }
            });
          }
        }
      }
      
      // Rate limit: wait 13 seconds before next chunk
      if (i < chunks.length - 1 && !rateLimitHit) {
        await new Promise(resolve => setTimeout(resolve, DELAY_BETWEEN_CHUNKS));
      }
    }
    
    // Step 4: Combine results
    const combined = combineResults(cachedResults, batchResults, tasks);
    
    console.log(`[Categorization] ✓ Completed: ${combined.categorizedCount} categorized, ${combined.defaultCount} defaulted`);
    
    return {
      results: combined.results,
      rateLimitHit,
      categorizedCount: combined.categorizedCount,
      defaultCount: combined.defaultCount
    };
    
  } catch (error) {
    console.error(`[Categorization] Batch categorization error: ${error.message}`);
    
    // Fallback: return all defaults
    const defaultResults = tasks.map(() => ({
      category: "General",
      source: "default",
      confidence: null
    }));
    
    return {
      results: defaultResults,
      rateLimitHit: false,
      categorizedCount: 0,
      defaultCount: tasks.length
    };
  }
};

/**
 * Clear the categorization cache (useful for testing or cache invalidation)
 */
const clearCache = () => {
  categorizationCache.clear();
  console.log("[Categorization] Cache cleared");
};

/**
 * Get cache statistics (for monitoring)
 */
const getCacheStats = () => {
  return {
    size: categorizationCache.size,
    maxSize: 1000,
    ttl: CACHE_TTL
  };
};

/**
 * Get health statistics (for monitoring)
 */
const getHealthStats = () => {
  const successRate = healthStats.totalRequests > 0 
    ? ((healthStats.successfulRequests / healthStats.totalRequests) * 100).toFixed(2)
    : 0;
  
  return {
    ...healthStats,
    successRate: `${successRate}%`,
    workingModel: workingModel || "none",
    models: getModelStatus(),
    cacheHitRate: healthStats.totalRequests > 0
      ? ((healthStats.cacheHits / healthStats.totalRequests) * 100).toFixed(2) + "%"
      : "0%"
  };
};

/**
 * Log the model setup on start. No API calls are made here (they would cost quota).
 */
const initializeModelDiscovery = async () => {
  const { primary, fallbacks } = getModelStatus();
  console.log(`[Categorization] AI ready. Model: ${primary}; fallbacks: ${fallbacks.join(", ") || "none"}`);
};

// Log the configuration on module load
if (process.env.ENABLE_AI_CATEGORIZATION !== "false") {
  initializeModelDiscovery();
}

module.exports = {
  categorizeTask,
  categorizeTasksBatch,
  clearCache,
  getCacheStats,
  getHealthStats,
  discoverWorkingModel,
  initializeModelDiscovery,
  // Reused by the RAG / Call Assist services
  getWorkingModel,
  getGeminiClient,
  CATEGORIES
};
