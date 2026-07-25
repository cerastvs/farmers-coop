-- Enforce one membership application per account.
CREATE UNIQUE INDEX "Application_userId_key" ON "Application"("userId");
