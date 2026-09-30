import request from "supertest";
import jwt from "jsonwebtoken";
import app from "../script";

// Valid-looking ObjectIds; no test needs these to exist in the database
export const IDS = {
  user: "507f1f77bcf86cd799439011",
  otherAgent: "507f1f77bcf86cd799439012",
  task: "507f1f77bcf86cd799439099",
};

/** Sign a session token like the login endpoint does (JWT_SECRET comes from vitest.config.js). */
export const tokenFor = (role, claims = {}) =>
  jwt.sign({ id: IDS.user, role, name: "Tester", ...claims }, process.env.JWT_SECRET);

/** supertest agent bound to the app, e.g. api().get("/health") */
export const api = () => request(app);

/** Request as a logged-in user: as("agent").post("/api/tasks") */
export const as = (role, claims) => {
  const token = tokenFor(role, claims);
  const wrap = (method) => (url) => request(app)[method](url).set("Authorization", `Bearer ${token}`);
  return { get: wrap("get"), post: wrap("post"), patch: wrap("patch"), delete: wrap("delete") };
};
