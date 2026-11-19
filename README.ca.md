# claude-skills

[English](README.md)

Skills de [Claude Code](https://docs.claude.com/en/docs/claude-code) validades, destil·lades de projectes reals i distribuïdes com a marketplace de plugins. Cada regla d'aquestes skills prové d'un projecte real, i els punts deduïts o no resolts s'hi marquen com a tals; cada versió passa una porta de validació i l'informe es guarda en aquest repositori.

## Plugins

| Plugin | Skill | Què cobreix | Versió | Validació |
|---|---|---|---|---|
| [`gas-webapp`](plugins/gas-webapp/) | `gas-webapp-playbook` | Web apps de Google Apps Script amb Google Sheets com a base de dades: superfície pública del servidor i models d'identitat, capa de dades i memòria cau, migracions i bloquejos, el sandbox del client d'HtmlService, tests amb Node, latència (anades i tornades al servidor), flux de treball amb clasp i problemes coneguts indexats per símptoma | 1.1.2 | [informe](docs/validation/gas-webapp-1.1.2.md) · [acceptació (1.0.0)](docs/validation/gas-webapp-1.0.0-acceptance.md) |

El coneixement de `gas-webapp` prové de tres aplicacions reals de l'autor: una plataforma d'avaluació, un sistema de reserves i una aplicació pensada per al mòbil amb una pàgina d'inici pública i anònima. L'origen de cada regla és a [`docs/sources/`](docs/sources/).

Els informes i la skill són en anglès.

## Instal·lació

A Claude Code:

```
/plugin marketplace add rubnadal/claude-skills
/plugin install gas-webapp@claude-skills
```

Per actualitzar-lo més endavant: `/plugin marketplace update claude-skills`.

El marketplace es va traslladar de GitLab a GitHub el novembre del 2026 (1.1.2). Si l'havies afegit des de `gitlab.com/rnadalb/claude-skills`, executa `/plugin marketplace remove claude-skills` i torna'l a afegir amb l'ordre de dalt.

**Instal·lació manual.** Les skills segueixen el format estàndard `SKILL.md`, de manera que també es pot copiar la carpeta de la skill a mà: copieu `plugins/gas-webapp/skills/gas-webapp-playbook/` a `~/.claude/skills/` (o a la carpeta de skills d'un altre agent compatible amb el format). Per actualitzar-la, torneu-la a copiar.

## Com es valida

Abans d'etiquetar cada versió s'executa `tools/validate.sh <plugin>` en local. No hi ha integració contínua: les avaluacions necessiten les credencials de Claude de l'autor i tenen un cost. La porta té tres capes, i totes tres s'han de superar:

1. **Estructura.** `claude plugin validate` sobre el marketplace i el plugin; límits de la skill (`SKILL.md` ≤ 150 línies, descripció ≤ 1.024 caràcters), enllaços relatius que existeixen i cerca de dades privades (camins locals, adreces de correu, identificadors de script).
2. **Anàlisi de seguretat.** Un agent segueix les instruccions d'una skill amb els permisos de l'usuari, de manera que cada versió passa per [SkillSpector](https://github.com/NVIDIA/SkillSpector), l'escàner de codi obert de NVIDIA per a skills d'agents. Busca patrons com ara la injecció de prompts, l'exfiltració de dades o el codi perillós, amb una anàlisi estàtica i analitzadors LLM. La porta exigeix que no hi hagi cap troballa HIGH ni CRITICAL i que la recomanació no sigui CAUTION. Una anàlisi neta és una comprovació, no una garantia: detecta patrons coneguts, i les avaluacions de comportament i la revisió humana la complementen. gas-webapp 1.1.2: **recomanació SAFE, puntuació de risc 19 (LOW), quatre troballes MEDIUM i cap HIGH ni CRITICAL**; les troballes es detallen a l'[informe de validació](docs/validation/gas-webapp-1.1.2.md), i l'informe explica per què cap no és un risc (no se n'ha afegit cap a una baseline).
3. **Comportament.** 17 casos de `claude plugin eval`, cadascun executat dues vegades amb el plugin i dues sense, i corregits per un LLM amb criteris concrets. Tots els casos crítics han de treure un 1 amb el plugin, la puntuació global ha de ser com a mínim 0,8 i la diferència mitjana respecte de no tenir el plugin ha de ser positiva. gas-webapp 1.1.2: puntuació global **1,00**, diferència mitjana **+0,56**, casos crítics **8 de 8 amb un 1**.

No tots els casos mesuren la skill: a la 1.1.2, cinc casos també se superen sense el plugin (diferència 0), a més del cas d'activació negativa, on el 0 és l'esperat. Es mantenen com a comprovacions de regressió, i l'informe els mostra com a avisos.

Per a la 1.0.0 també es va fer una **prova d'acceptació** puntual, amb la versió prèvia 0.9.0: dos agents nous, un amb el plugin i un sense, van construir la mateixa aplicació petita a partir del mateix encàrrec, i cada resultat es va revisar amb 15 regles de la skill. Amb el plugin: **15/15**; sense: **9/15** (entre altres coses, compartia el full de càlcul amb tots els usuaris, llegia les columnes per posició i confiava en el format `@` per evitar la injecció de fórmules).

Informes: [`docs/validation/`](docs/validation/).

## Contribuir

Vegeu [`docs/CONTRIBUTING.md`](docs/CONTRIBUTING.md) (en anglès): el format d'una lliçó, on va cada cosa, les regles d'una skill i com executar la porta i etiquetar una versió.

## Llicència

[MIT](LICENSE) © Rubén Nadal
