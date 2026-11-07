# Disseny — repositori `claude-skills` i `gas-webapp-playbook` v1.0.0

**Data:** 2026-11-07 · **Autor:** Rubén Nadal (amb Claude Code) · **Estat:** pendent de revisió

## 1. Objectiu

Publicar per a la comunitat una skill de Claude Code que faciliti, de manera efectiva, eficient,
validada i amb criteri, el desenvolupament de Web Apps de Google Apps Script amb Google Sheets com a
base de dades. La skill recull el coneixement de tres aplicacions reals del mateix autor:

| Codi | Projecte | Què hi aporta sobretot |
|---|---|---|
| [MPRO] | MPRO Avaluació (`mpro_intermodular`) | capa de dades amb cache, rols per recurs, migracions, model d'identitat B, arnès de tests GAS en Node |
| [ATECA] | Reserves ATECA (`reserves_ateca`) | identitat per token i `rpc`, correu i triggers, test de superfície pública |
| [BARRA] | Barralliure (`barralliure`) | ús des del mòbil, instal·lador amb menú, cua de correu, arnès de client amb jsdom |

Alhora, crear un repositori exclusiu per anar publicant aquesta i futures skills.

**Criteris d'èxit:**
- La skill s'instal·la amb dues ordres des de Claude Code i també es pot copiar a mà (estàndard `SKILL.md`).
- Cada versió publicada passa una porta de validació reproduïble (§4) i en deixa l'informe al repositori.
- La v1.0.0 passa a més una prova d'acceptació amb un agent nou (§5.3).

## 2. Decisions preses

| Decisió | Triat | Descartat i per què |
|---|---|---|
| Públic | Comunitat global; skill en anglès, README en anglès i català | Només català: arribaria a molt menys públic; els models segueixen igual una skill en anglès |
| Allotjament | GitLab públic (`gitlab.com/rnadalb/claude-skills`) | GitHub: es planteja més endavant dins una migració global de l'autor |
| Validació | Escenaris automàtics + prova d'acceptació + skillspector | Una sola d'elles deixa forats (regressions, casos no previstos, seguretat) |
| Llindar skillspector | Estricte: cap HIGH/CRITICAL, recomanació final no CAUTION; baseline amb justificació per entrada | Zero troballes: obligaria a treure referències legítimes; informatiu: no garanteix res |
| Peces existents | Substitució del repo antic, sense tocar els tres projectes | Tocar-los ara faria el projecte més gran i arriscat; dues versions vives es desincronitzarien |
| Format | Marketplace de plugins de Claude Code | Carpetes soltes: sense versions ni actualització; un repo per skill: massa estructura |
| Llicència | MIT | — |

## 3. Repositori

```
claude-skills/
├── .claude-plugin/marketplace.json        catàleg: name "claude-skills", owner, plugins[]
├── plugins/
│   └── gas-webapp/
│       ├── .claude-plugin/plugin.json     name, version (semver), description, author, license
│       ├── skills/gas-webapp-playbook/    la skill (§5.1)
│       ├── evals/                         escenaris de `claude plugin eval` (§5.2)
│       └── CHANGELOG.md
├── tools/
│   ├── validate.sh                        porta de publicació (§4)
│   └── skillspector-baseline/<plugin>.json
├── docs/
│   ├── CONTRIBUTING.md                    (EN) format d'una entrada, com afegir una skill nova
│   ├── design/                            aquest document i futurs dissenys
│   ├── sources/                           inventari de coneixement amb l'origen de cada regla
│   └── validation/<plugin>-<versió>.md    informe de cada versió publicada
├── README.md (EN) · README.ca.md (CA)
└── LICENSE (MIT)
```

**Instal·lació (README):**
```
/plugin marketplace add https://gitlab.com/rnadalb/claude-skills.git
/plugin install gas-webapp@claude-skills
```
Actualització: `/plugin marketplace update claude-skills`. Alternativa manual: copiar
`plugins/gas-webapp/skills/gas-webapp-playbook/` a `~/.claude/skills/` (o a la carpeta de skills d'un
altre agent compatible amb l'estàndard).

El nom de la skill es manté (`gas-webapp-playbook`): Barralliure la cita pel nom al seu `CLAUDE.md`.

## 4. Porta de validació (`tools/validate.sh <plugin>`)

S'executa en local abans d'etiquetar cada versió. Les tres comprovacions s'han de complir; si en falla
una, no es publica.

1. **Estructura:** `marketplace.json` i `plugin.json` vàlids i coherents (nom i versió); `description`
   del frontmatter de cada `SKILL.md` ≤ 1.024 caràcters; tots els enllaços relatius entre fitxers
   existeixen; cap dada privada (patrons: `scriptId`, adreces de correu reals, camins `~/gitLab`,
   `/Users/`).
2. **skillspector** (`SKILLSPECTOR_PROVIDER=claude_cli`, analitzadors semàntics actius): cap troballa
   HIGH ni CRITICAL i recomanació final diferent de CAUTION. Les troballes acceptades com a falsos
   positius van a `tools/skillspector-baseline/<plugin>.json`, cadascuna amb una justificació d'una
   línia. Punt de partida mesurat avui (skill 0.2.1, sense LLM): risc 37, MEDIUM, CAUTION, dues
   troballes HIGH `AE1` per anàlisi incompleta de fitxers referenciats.
3. **`claude plugin eval`** amb `--ablation with-without` i `--max-cost-usd`: tots els escenaris crítics
   passen amb el plugin; puntuació global ≥ 80 %; diferència amb/sense plugin positiva.

Cada execució que precedeix una versió deixa `docs/validation/<plugin>-<versió>.md` amb les
puntuacions, la diferència amb/sense plugin i el resum de skillspector.

**Sense CI a GitLab** en aquesta versió: les evals i skillspector necessiten la credencial de Claude de
l'autor i tenen cost. Una CI que només faci la comprovació 1 queda fora d'abast (§7).

## 5. Contingut de la skill

### 5.1 Recollida i estructura

**Fonts per projecte:** `CLAUDE.md` (i `html/CLAUDE.md`), skills locals (`.claude/skills/`), `docs/`
(historial del ROADMAP, pendents, documentació tècnica), memòries de Claude del projecte i commits
`fix:` posteriors a la v0.2.1 de la skill. També la skill actual (v0.2.1) com a punt de partida.

**Inventari (`docs/sources/inventari.md`):** una fitxa per candidat amb *símptoma, causa, regla,
origen*. L'origen indica els projectes que l'han confirmat: `[MPRO]`, `[ATECA]`, `[BARRA]`; la marca
`[2]` de la v0.2 es substitueix per `confirmed 1/3 · 2/3 · 3/3`.

**Criteris de filtre:**
- Només el que és reutilitzable i ha costat un bug real. El domini de cada projecte en queda fora.
- Una contradicció entre projectes es converteix en una decisió amb les opcions i quan val cada una
  (cas tipus: identitat model A — sessió de domini — vs. model B — desplegador + enllaç `?t=`).
- Cap dada privada: ni `scriptId`, ni correus, ni camins locals, ni noms del centre. Les referències
  "mira `Auth.gs` del projecte X" es converteixen en fragments de codi genèrics dins la skill.

**Estructura (en anglès):**
```
skills/gas-webapp-playbook/
  SKILL.md                  ≤ ~150 línies: quan s'activa, taula "què llegir", 15–20 regles, arrencada
  references/
    security-and-api.md     superfície pública, models d'identitat A/B (matriu de decisió), token + rpc
                            + auth-client, enllaços de correu, injecció de fórmules, setup no reexecutable
    architecture.md         capa de dades, cache 6 h + memòria per execució, migracions, LockService,
                            cua de correu, triggers, instal·lador
    client-sandbox.md       regles del parser i de l'iframe, navegació, i18n, mòbil
    testing.md              arnès Node (vm + Sheets simulat des de capçaleres), test de llista blanca de la
                            superfície pública, arnès de client amb jsdom, baseline de tests GAS
    gotchas.md              índex símptoma → causa → solució
    workflow.md             cicle d'una feature, clasp i entorns, QA, worktrees (com a opcions)
  templates/
    CLAUDE.template.md · claspignore.template
    appsscript.model-a.json · appsscript.model-b.json
    public-surface.test.js  plantilla (no s'executa des de la skill)
```

`SKILL.md` es carrega sencer en cada activació: ha de ser curt. Els fitxers de `references/` només es
llegeixen quan la situació ho demana. El cost en tokens es mesura amb `claude plugin details`. Si
l'inventari de [BARRA] dona prou material (mòbil, landing pública, instal·lador), es pot crear un fitxer
propi; la decisió es pren amb l'inventari fet i es comenta a l'autor.

### 5.2 Escenaris (`plugins/gas-webapp/evals/`)

Dos tipus: **activació** (corrector `tool_used: Skill`) i **aplicació** (corrector LLM amb criteris
concrets). El format exacte de `case.yaml` i dels correctors es verifica a la documentació de
`claude plugin eval` en escriure el pla.

| # | Escenari | Crític |
|---|---|---|
| 1 | Afegir una funció de servidor per eliminar un usuari: sufix `_` a les internes, verificació de rol a la 1a línia, cap identitat per paràmetre | ✔ |
| 2 | Professorat d'un domini extern + desplegador en domini propi → model B; mai `ANYONE_ANONYMOUS` | ✔ |
| 3 | Llegir un flag `actiu` del full → comprovació positiva dual | ✔ |
| 4 | Inserir 500 files → escriptura en bloc, cap `appendRow` en bucle | ✔ |
| 5 | Codi de client amb templates niats i navegació amb `window.location` → reescriure-ho | ✔ |
| 6 | Símptoma `res is null` → `null` eliminat en serialitzar; `!res \|\| !res.ok` | ✔ |
| 7 | Full en català converteix "9.7" en data → escriure com a Number | |
| 8 | Codi amb zeros a l'esquerra que es perden | |
| 9 | Dates desplaçades un dia | |
| 10 | Dades velles després d'editar el full a mà → invalidació de cache | |
| 11 | `clasp push` només diu "Skipping push." | |
| 12 | Afegir una columna → migració + setup sincronitzats | |
| 13 | Enllaç de correu que modifica dades → pàgina de confirmació | |
| 14 | Setup reexecutable → escalada de privilegis | |
| 15 | Activació positiva: "començo una web app amb Apps Script i Sheets" | ✔ |
| 16 | Activació negativa: "app React amb Supabase" → no s'activa | ✔ |

**Regla de qualitat:** un escenari que també passa sense el plugin no mesura res de la skill; es fa més
difícil o s'elimina. Cada validació són unes 32 execucions d'agent (16 × 2).

### 5.3 Prova d'acceptació (només v1.0.0)

En un directori buit, dos agents nous (amb plugin i sense) reben el mateix encàrrec: *mini-app GAS +
Sheets amb un full d'elements, rol admin, pàgina de llistat, una funció d'escriptura, usuaris de dos
dominis i setup inicial.* Sense desplegar res. Cada resultat es revisa amb una llista d'unes 15 regles
de la skill (greps, sintaxi amb Node, test de superfície pública de la plantilla) i s'anota què no
preveu cap escenari. Informe a `docs/validation/gas-webapp-1.0.0-acceptance.md`; els forats trobats
poden generar escenaris nous.

## 6. Publicació i transició

**Versions:** semver per plugin. Patch = gotcha nou o correcció; minor = fitxer o secció nova; major =
canvi de regla que contradiu versions anteriors. Cada versió: `CHANGELOG.md` + informe de validació +
etiqueta `gas-webapp-vX.Y.Z`.

**Ordre de treball:**
1. Esquelet del repo + `validate.sh` (comprovació d'estructura).
2. Inventari de les tres fonts → `docs/sources/`.
3. Redacció de la skill en anglès.
4. Escenaris.
5. `validate.sh` complet i correccions fins que passi.
6. Prova d'acceptació.
7. README EN/CA, CONTRIBUTING, etiqueta `gas-webapp-v1.0.0`.
8. Transició.

**Transició** (cada pas irreversible, amb confirmació explícita de l'autor):
- Repo antic `gas-webapp-playbook`: desar el canvi pendent (`seguretat-api.md` §6) i pujar-lo amb el
  commit no pujat, perquè l'arxiu quedi complet; afegir un avís al README que apunti al repo nou.
  L'autor l'arxiva des de GitLab (*Settings → General → Archive*).
- Repo nou a GitLab: el crea l'autor (buit i públic) o es fa amb `glab` si està configurat. Tot push,
  amb confirmació.
- Portàtil: moure `~/.claude/skills/gas-webapp-playbook` a una còpia de seguretat (no esborrar-la),
  instal·lar el plugin des del repo nou i comprovar que s'activa en una sessió de MPRO o Barralliure.
  Tornar enrere = restaurar la carpeta.
- No es toquen ni el codi, ni els `CLAUDE.md`, ni les skills locals dels tres projectes.

## 7. Fora d'abast

- Mirall o migració a GitHub.
- CI a GitLab (fins i tot la que només comprovaria l'estructura).
- Netejar els duplicats de coneixement genèric als tres projectes (skills locals de MPRO, `CLAUDE.md`).
- Skills noves al repositori.

## 8. Riscos

| Risc | Mitigació |
|---|---|
| skillspector continua marcant `AE1` per fitxers referenciats | Comprovar si desapareix amb els analitzadors semàntics actius; si no, baseline justificada (és un límit de l'escàner, no codi maliciós) |
| Escenaris que el model ja resol sense la skill | Regla de qualitat de §5.2 |
| Cost de les evals | `--max-cost-usd` i `--case` per iterar només els escenaris afectats |
| Filtrar dades privades a un repo públic | Comprovació automàtica de §4.1 + revisió de l'autor abans del primer push |
| `SKILL.md` massa llarg | Pressupost de línies i `claude plugin details` |
