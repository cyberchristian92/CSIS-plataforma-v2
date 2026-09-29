-- "Entrar com Google": identificador da conta Google (claim "sub").
ALTER TABLE "User" ADD COLUMN "google_sub" TEXT;

CREATE UNIQUE INDEX "User_google_sub_key" ON "User"("google_sub");
