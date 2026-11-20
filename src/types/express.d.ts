declare namespace Express {
  interface Request {
    user?: import("./auth.js").AuthUser;
  }
}