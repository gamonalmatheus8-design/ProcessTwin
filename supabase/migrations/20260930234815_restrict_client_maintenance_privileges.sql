-- RLS governs row operations, not TRUNCATE. Browser/session roles need DML only.
revoke truncate, references, trigger on all tables in schema public from authenticated, anon;
