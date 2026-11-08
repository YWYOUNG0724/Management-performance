import { checkAuth } from "../lib/auth.js";
export default function handler(req, res) {
  if (!checkAuth(req, res)) return;
  res.status(200).json({ ok: true, ai: !!process.env.ANTHROPIC_API_KEY, law: !!process.env.LAW_OC });
}
