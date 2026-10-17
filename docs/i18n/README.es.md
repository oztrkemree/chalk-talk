<div align="center">

# chalk-talk

### No leas el mapa. Mira el recorrido.

Pregúntale a tu agente de código *"¿cómo funciona esto?"* y recibe un recorrido animado, paso a paso, por el camino real del código, en un solo archivo HTML, donde **cada flecha está rastreada hasta la línea de código en la que ocurre** o marcada honestamente como una suposición.

[**Sitio en vivo y galería**](https://oztrkemree.github.io/chalk-talk/) · [Instalación](#instalación) · [Pruebas](#cada-flecha-tiene-su-prueba) · [Explicar un PR](#explicar-un-pull-request) · [Formato de escena](../../skills/chalk-talk/references/scene-spec.md)

![Licencia MIT](https://img.shields.io/badge/license-MIT-blue) ![Un solo archivo HTML](https://img.shields.io/badge/output-one%20HTML%20file-ff5a5f) ![Sin dependencias](https://img.shields.io/badge/dependencies-none-2ea44f) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Claude%20Code%20%C2%B7%20Codex%20%C2%B7%20Cursor%20%C2%B7%20Gemini-d97757)

[English](../../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · Español · [Türkçe](README.tr.md)

![Lo que git commit escribe en disco, dibujado en una pizarra: los objetos aparecen uno a uno y los paquetes viajan entre ellos](../media/hero-chalk.gif)

<sub>`git commit`, explicado desde el propio código fuente de git. 9 de 9 saltos rastreados hasta el código. <a href="https://oztrkemree.github.io/chalk-talk/gallery/git-commit/git-commit.html?style=chalk">Ábrelo en vivo →</a></sub>

</div>

## Por qué

Los diagramas y los grafos de conocimiento te muestran **qué existe**. Pero cuando aterrizas en un codebase nuevo, o te quedas mirando un PR que escribió una IA, la pregunta real es **qué pasa, en qué orden y en qué parte del código**.

chalk-talk responde como lo haría un buen ingeniero frente a una pizarra: una cosa a la vez. La primera caja, una frase, una flecha, un paquete que viaja por ella ("`JWT`", "`order #42`", "`SELECT`"). Lo anterior se atenúa; lo nuevo se ilumina. Al final, el viaje completo se repite de principio a fin. Haz clic en cualquier bloque o flecha y se abren las líneas exactas, con un permalink de GitHub.

Tu agente escribe un archivo de escena diminuto. El motor se encarga del layout, el trazado de rutas, el dibujo en 3D y la animación, y luego hace una captura de cada paso para que el agente revise su propio trabajo antes de que tú lo veas.

## Cada flecha tiene su prueba

Un diagrama animado que está mal es peor que no tener diagrama: es una alucinación *más convincente*. Por eso en chalk-talk una flecha no solo se dibuja. Se **cita**:

```json
{ "from": "router", "to": "layer", "label": "match(path)",
  "code": "router/index.js:230-247", "calls": "matchLayer(layer, path)" }
```

El build abre el archivo, lee esas líneas y comprueba que `matchLayer(layer, path)` esté realmente ahí. Después, cada flecha recibe una marca:

| marca | significa |
|---|---|
| ✓ **verified** (verificada) | las líneas citadas existen y contienen la llamada |
| **?** **inferred** (inferida) | no hay ninguna línea a la que apuntar (frontera de red, despacho dinámico); se indica el motivo |
| **!** **broken** (rota) | la llamada no está en esas líneas. El build avisa y el agente lo corrige |

```
$ node scripts/build.mjs express-request.scene.json
proof: 7/9 hops traced to code (7 verified, 0 cited) · 2 inferred · 0 broken
```

Pulsa **`V`** en cualquier charla para ver qué saltos están probados. El resumen final lo dice bien claro: *"7 of 9 hops traced to code · 2 inferred"*.

![Vista de pruebas: el recorrido de una petición en Express 5, cada flecha probada con una marca de verificación y los dos saltos inferidos punteados con un signo de interrogación](../media/proof-view.png)

## Galería

Cada charla de abajo la escribió un agente a partir del código fuente real, y cada flecha está verificada.

| charla | repo | prueba |
|---|---|---|
| [Qué escribe git commit en disco](https://oztrkemree.github.io/chalk-talk/gallery/git-commit/git-commit.html) | git/git | 9/9 rastreados |
| [Cómo Codex CLI ejecuta un comando de shell](https://oztrkemree.github.io/chalk-talk/gallery/codex-exec/codex-exec.html) | openai/codex | 10/10 rastreados |
| [Cómo Vite actualiza un módulo en caliente](https://oztrkemree.github.io/chalk-talk/gallery/vite-hmr/vite-hmr.html) | vitejs/vite | 7/8 rastreados, 1 inferido |
| [Qué hace Redis con `SET greeting hello`](https://oztrkemree.github.io/chalk-talk/gallery/redis-set/redis-set.html) | redis/redis | 8/9 rastreados, 1 inferido |
| [Cómo FastAPI llama a tu función](https://oztrkemree.github.io/chalk-talk/gallery/fastapi-request/fastapi-request.html) | fastapi/fastapi | 8/9 rastreados, 1 inferido |
| [Qué pasa cuando una petición llega a `app.get()`](https://oztrkemree.github.io/chalk-talk/gallery/express-request/express-request.html) | expressjs/express | 7/9 rastreados, 2 inferidos |
| [PR #7459: las respuestas chunked recuperan su ETag](https://oztrkemree.github.io/chalk-talk/gallery/express-pr/express-pr.html) | expressjs/express | 5/6 rastreados, 1 inferido |
| [Cómo chalk-talk prueba cada flecha](https://oztrkemree.github.io/chalk-talk/skills/chalk-talk/examples/build.html) | este repo | 6/7 rastreados, 1 inferido |

`→` / `space` avanza, `P` reproduce, `V` vista de pruebas, `T` claro/oscuro; haz clic en un bloque o una flecha para ver su código.

## Explicar un pull request

> explícame este PR con un chalk talk

El agente lee el diff y cuenta el recorrido **tal como queda después del cambio**, con lo que cambió resaltado: `NEW`, `CHANGED`, `REMOVED`, una etiqueta `PR #7459 · +2 ~4`, y **`D`** para alternar entre el antes y el después. Pega el GIF en la descripción del PR y los revisores verán el cambio antes de leerlo.

![Modo cambios: el PR #7459 de Express, con los bloques modificados rodeados en ámbar, el nuevo handler en verde y la etiqueta del PR en la esquina](../media/change-mode.png)

## Instalación

**Claude Code**

```
/plugin marketplace add oztrkemree/chalk-talk
/plugin install chalk-talk@chalk-talk
```

**Codex, Cursor, Gemini CLI, OpenCode, Copilot y [más de 40 agentes](https://agentskills.io)**

```bash
npx skills add oztrkemree/chalk-talk
```

**A mano**: copia `skills/chalk-talk` en la carpeta de skills de tu agente (`~/.claude/skills/`, `~/.codex/skills/`, ...).

Los scripts necesitan Node 18+ (Windows, macOS, Linux). La autocomprobación visual usa cualquier Chrome, Edge, Brave o Chromium que tengas instalado.

## Uso

Solo pregunta, en el idioma que quieras:

> ¿cómo funciona la autenticación en este repo?
>
> explícame paso a paso qué pasa cuando llega un webhook
>
> explícame este PR con un chalk talk

o llámalo directamente: `/chalk-talk el flujo de pago`.

El agente escribe `chalk-talks/<name>.scene.json`, genera `chalk-talks/<name>.html`, revisa cada paso con una captura y lo abre. Conserva el archivo de escena: pide cambios ("divide el paso 3", "muestra el camino de reintento") y el agente lo edita.

| tecla | hace |
|---|---|
| `→` / `space` / clic | paso siguiente |
| `←` | paso anterior |
| `P` | reproducción automática (`?play=loop` en la URL la repite en bucle) |
| `V` | vista de pruebas: qué saltos están rastreados hasta el código |
| `D` | antes / después, en una charla de PR |
| `C` / clic en un bloque o flecha | el código que hay detrás |
| `T` | claro ↔ oscuro |
| `1`–`9` | saltar a un paso (también `#3` en la URL) |

En el móvil, el tablero se pone en vertical y sigue la parte de la que trata cada paso.

## Compártelo

Una charla es **un solo archivo HTML**: sin servidor, funciona offline, mándaselo a quien quieras. `CHALK_SHARE=1` deja fuera tus rutas locales y conserva los permalinks de GitHub.

¿Lo necesitas incrustado en un README, un PR o Slack?

```bash
node skills/chalk-talk/scripts/record.mjs chalk-talks/auth.html --out auth.gif --style chalk
```

`record.mjs` controla tu Chrome instalado fotograma a fotograma (sin ffmpeg, sin paquetes de npm) y genera un GIF en bucle. También acepta `--steps 2-5`, `--width 960`, `--theme dark`.

## Estilos

| | |
|---|---|
| **iso** (por defecto) | pequeños bloques 3D sobre un suelo isométrico; los servidores parpadean cuando llega un paquete, las bases de datos ondulan con cada escritura, las colas se llenan y se vacían |
| **chalk** | el mismo tablero dibujado con tiza sobre una pizarra: trazos a mano, sombreado en tonos pastel |
| **studio** · **blueprint** · **editorial** | layouts planos de tarjetas para sistemas más grandes |

`"style": "chalk"` en la escena, o `?style=chalk` en cualquier charla.

## Cómo funciona

```
your question ──▶ agent reads the code ──▶ scene.json ──▶ build.mjs ──▶ talk.html
                                               ▲          (proof check)      │
                                               └──── check.mjs: report + PNG per step
```

Una escena es JSON plano: nodos sobre una cuadrícula gruesa, aristas entre ellos (con el código que las prueba) y pasos que dicen qué mostrar, qué fluye y qué contar:

```json
{
  "title": "How logging in works",
  "nodes": [
    { "id": "web", "kind": "browser", "label": "Web app", "at": [0, 0] },
    { "id": "api", "label": "Auth API", "sub": "POST /login", "icon": "key", "at": [1, 0],
      "code": "src/auth/login.ts:12-40" }
  ],
  "edges": [
    { "id": "req", "from": "web", "to": "api", "label": "POST /login", "packet": "email, pw",
      "code": "src/web/login.tsx:31-38", "calls": "fetch('/login'" }
  ],
  "steps": [
    { "title": "The request", "say": "The web app sends both to the **Auth API**.", "show": ["req"], "flow": ["req"] }
  ]
}
```

El motor (una sola plantilla HTML, sin dependencias) proyecta la cuadrícula sobre un suelo isométrico, dibuja cada nodo como un objeto 3D, traza las rutas esquivando los bloques, coloca las etiquetas donde no tapan nada e informa de lo que no pudo arreglar (`arrow api -> db runs through cache`) para que el agente cambie la escena. Nueve tipos de bloques, 37 iconos, un layout de secuencia para handshakes y OAuth, cinco estilos. Todo está en la [referencia de escenas](../../skills/chalk-talk/references/scene-spec.md).

Monta una charla a mano, sin agente:

```bash
node skills/chalk-talk/scripts/build.mjs my-talk.scene.json   # writes my-talk.html, checks proof
node skills/chalk-talk/scripts/check.mjs my-talk.html         # layout report + a PNG per step
```

## Preguntas frecuentes

**¿Puede seguir equivocándose?** Sí: un agente puede elegir la historia equivocada o simplificar de más. Lo que no puede hacer en silencio es dibujar una flecha que afirme una llamada que no está en el código: eso es un `!` y un aviso del build. Las marcas `?` te muestran exactamente dónde la charla se apoya en el criterio y no en una línea de código.

**¿Mi código se envía a algún sitio?** No. chalk-talk es una skill que tu agente ejecuta en local. La página es un archivo en tu disco; no se sube nada.

**¿Repos grandes?** Un recorrido por charla, unos 8 bloques. Pide el siguiente recorrido y tendrás la siguiente charla. Varias charlas pequeñas y enfocadas valen más que un mapa ilegible.

## Créditos

- Fuentes: [Geist](https://vercel.com/font) de Vercel, [IBM Plex](https://www.ibm.com/plex/) de IBM, [Inter Tight](https://rsms.me/inter/), [Newsreader](https://fonts.google.com/specimen/Newsreader), [Caveat](https://fonts.google.com/specimen/Caveat) y [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand), todas bajo la SIL Open Font License, cargadas desde Google Fonts y no incluidas en el paquete.
- La idea de avanzar paso a paso le debe mucho a las explorable explanations de Nicky Case y a los zines de Julia Evans.

## Licencia

[MIT](../../LICENSE). Úsalo, haz un fork, publícalo. Si te ayudó a entender algo, una ⭐ ayuda a que otros lo encuentren.
