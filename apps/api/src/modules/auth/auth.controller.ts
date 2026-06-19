import { Request, Response } from "express";

// M1 MVP AUTH - Practice File
// ============================================================
// Each function below is a TODO for you to implement!
// Read docs/milestones/M1-mvp-auth.md for step-by-step instructions.
// ============================================================

// TODO: Step 2 - Signup handler
// Call authService.signup() and return the created user
export async function signup(req: Request, res: Response) {
  res.json({ message: "TODO: implement signup" });
}

// TODO: Step 3 - Login handler
// Call authService.login(), set HttpOnly cookies for browsers,
// or return tokens in body if X-Auth-Token-Transport: body header is set
export async function login(req: Request, res: Response) {
  res.json({ message: "TODO: implement login" });
}

// TODO: Step 4 - Get current user
// Read req.user (set by authenticate middleware) and return profile
export async function getMe(req: Request, res: Response) {
  res.json({ message: "TODO: implement getMe" });
}

// These will be implemented in later milestones
export async function refreshToken(req: Request, res: Response) {
  res.json({ message: "TODO: implement refresh (Milestone 3)" });
}

export async function logout(req: Request, res: Response) {
  res.json({ message: "TODO: implement logout (Milestone 3)" });
}

export async function logoutAll(req: Request, res: Response) {
  res.json({ message: "TODO: implement logoutAll (Milestone 3)" });
}
