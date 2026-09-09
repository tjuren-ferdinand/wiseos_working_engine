# WiseOS arbetsregler

- Frontend-förbättringar görs på `mvp_frontend_v1`. Ändra inte `main`, pusha eller driftsätt utan uttryckligt godkännande.
- Bevara befintliga arbetskopie- och indexändringar. Blanda inte in användarens tidigare ändringar i egna commits.
- Bevara login-bilder, rättningsberäkningar och den separata print-routen om uppgiften inte uttryckligen omfattar dem.
- Aktiva UI-primitiver finns under `apps/web/components/ui`; semantiska `ink`/`paper`-färger styrs av `globals.css` och `tailwind.config.ts`. Teman: light, cream och dark.

## Verifiering

- Från reporoten: `pnpm --filter @wiseos/web lint` och `pnpm build:web`.
- Från `apps/web`: `pnpm exec tsc --noEmit --incremental false`.
- Kör inte Next dev och build samtidigt mot samma `.next`-katalog.
- Windows CRLF kan ge falska blankstegsvarningar. Kontrollera med `git -c core.whitespace=cr-at-eol diff --check` utan att ändra git-konfigurationen.
- Frontend har ingen konfigurerad browser-testsvit. Build/SSR-kontroller ersätter inte manuell kontroll av mobilvy, tangentbord och teman.

## API-tester och isolering

- Backend-konfigurationen läser både rotens och `apps/api`-katalogens `.env`. Kör aldrig tester med en verklig databas eller verkliga provideruppgifter.
- Sätt `DATABASE_URL=sqlite://`, töm Sentry/Supabase/AI-provideruppgifter i testprocessens miljö och blockera utgående HTTP när isolerade tester körs. Ändra inte lokala `.env`-filer.
- Fokuserad regression från `apps/api`: `python -m pytest -q tests/test_rate_limits.py tests/test_grade_thresholds.py tests/test_legacy_routes_unmounted.py tests/test_courses_api.py -p no:cacheprovider` under isoleringen ovan.
- Vissa äldre provider-tester behöver explicit fake-providerkonfiguration utöver mockar. Kör inte verkliga integrationer för att få dessa tester gröna.
- Legacy-routrarna assignments/submissions är inte monterade. Deras lokala Teacher/User-identiteter får inte likställas med Supabase-ID utan verifierad migrering. Regressionstestet skyddar route-registreringen, inte legacy-handlernas ägandeskapskontroller.
- Rate limits för batch-rättning och facitgenerering är separata, processlokala fönster om 10 anrop per användare och 60 sekunder. Flera workers/replicas behöver delad räknare för ett globalt tak; omstart återställer räknarna.
