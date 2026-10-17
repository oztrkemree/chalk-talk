<div align="center">

# chalk-talk

### 지도를 읽지 말고, 여정을 보세요.

코딩 에이전트에게 *"이거 어떻게 동작해?"* 라고 물으면, 실제 코드 경로를 단계별로 따라가는 애니메이션 설명을 HTML 파일 하나로 받아볼 수 있습니다. **모든 화살표는 그 일이 일어나는 코드 줄까지 추적되며**, 추적할 수 없는 것은 솔직하게 추측이라고 표시됩니다.

[**라이브 사이트 & 갤러리**](https://oztrkemree.github.io/chalk-talk/) · [설치](#설치) · [증명](#모든-화살표에는-근거가-있다) · [PR 설명](#pr-설명하기) · [씬 포맷](../../skills/chalk-talk/references/scene-spec.md)

![MIT 라이선스](https://img.shields.io/badge/license-MIT-blue) ![HTML 파일 하나](https://img.shields.io/badge/output-one%20HTML%20file-ff5a5f) ![의존성 없음](https://img.shields.io/badge/dependencies-none-2ea44f) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Claude%20Code%20%C2%B7%20Codex%20%C2%B7%20Cursor%20%C2%B7%20Gemini-d97757)

[English](../../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · 한국어 · [Español](README.es.md) · [Türkçe](README.tr.md)

![git commit이 디스크에 무엇을 쓰는지 칠판에 그린 모습: 객체가 하나씩 나타나고 그 사이로 패킷이 오간다](../media/hero-chalk.gif)

<sub>`git commit`을 git의 소스 코드로 직접 설명합니다. 9개 홉 중 9개를 코드까지 추적. <a href="https://oztrkemree.github.io/chalk-talk/gallery/git-commit/git-commit.html?style=chalk">라이브로 열기 →</a></sub>

</div>

## 왜 만들었나

다이어그램과 지식 그래프는 **무엇이 있는지**를 보여줍니다. 하지만 낯선 코드베이스에 처음 들어갔을 때, 혹은 AI가 작성한 PR을 멍하니 바라보고 있을 때 정말 궁금한 건 **무엇이, 어떤 순서로, 코드의 어디에서 일어나는가**입니다.

chalk-talk은 화이트보드 앞에 선 실력 좋은 엔지니어처럼 답합니다. 한 번에 하나씩. 첫 번째 상자, 한 문장, 화살표, 그리고 그 위를 지나가는 패킷("`JWT`", "`order #42`", "`SELECT`"). 앞선 부분은 흐려지고 새 부분에 불이 들어옵니다. 마지막에는 전체 여정이 다시 재생됩니다. 블록이나 화살표를 클릭하면 해당 코드 줄이 GitHub 영구 링크와 함께 열립니다.

에이전트는 작은 씬 파일 하나만 작성합니다. 레이아웃, 경로 배치, 3D 렌더링, 애니메이션은 엔진이 맡고, 모든 단계를 스크린샷으로 찍어서 여러분이 보기 전에 에이전트가 스스로 결과물을 검토하게 합니다.

## 모든 화살표에는 근거가 있다

틀린 애니메이션 다이어그램은 다이어그램이 없는 것보다 나쁩니다. *더 그럴듯한* 환각일 뿐이니까요. 그래서 chalk-talk에서 화살표는 그냥 그려지지 않습니다. **출처가 달립니다**:

```json
{ "from": "router", "to": "layer", "label": "match(path)",
  "code": "router/index.js:230-247", "calls": "matchLayer(layer, path)" }
```

빌드할 때 파일을 열어 해당 줄을 읽고, `matchLayer(layer, path)`가 정말 거기 있는지 확인합니다. 그런 다음 모든 화살표에 표시가 붙습니다:

| 표시 | 의미 |
|---|---|
| ✓ **verified** (검증됨) | 인용한 줄이 존재하고, 그 호출을 포함함 |
| **?** **inferred** (추정) | 가리킬 줄이 없음(네트워크 경계, 동적 디스패치). 이유를 함께 표시 |
| **!** **broken** (깨짐) | 그 줄에 호출이 없음. 빌드가 경고하고, 에이전트가 고침 |

```
$ node scripts/build.mjs express-request.scene.json
proof: 7/9 hops traced to code (7 verified, 0 cited) · 2 inferred · 0 broken
```

어떤 토크에서든 **`V`** 키를 누르면 어떤 홉이 증명됐는지 볼 수 있습니다. 마지막 요약에서도 분명하게 말해줍니다: *"7 of 9 hops traced to code · 2 inferred"*.

![증명 뷰: Express 5 요청의 여정. 증명된 화살표에는 체크 표시, 추정된 두 홉은 물음표가 달린 점선](../media/proof-view.png)

## 갤러리

아래 토크는 모두 에이전트가 실제 소스를 보고 작성했고, 모든 화살표가 검사를 거쳤습니다.

| 토크 | 저장소 | 증명 |
|---|---|---|
| [git commit이 디스크에 쓰는 것](https://oztrkemree.github.io/chalk-talk/gallery/git-commit/git-commit.html) | git/git | 9/9 추적 |
| [Codex CLI가 셸 명령을 실행하는 방법](https://oztrkemree.github.io/chalk-talk/gallery/codex-exec/codex-exec.html) | openai/codex | 10/10 추적 |
| [Vite가 모듈을 핫 업데이트하는 방법](https://oztrkemree.github.io/chalk-talk/gallery/vite-hmr/vite-hmr.html) | vitejs/vite | 7/8 추적, 1 추정 |
| [Redis는 `SET greeting hello`로 무엇을 하는가](https://oztrkemree.github.io/chalk-talk/gallery/redis-set/redis-set.html) | redis/redis | 8/9 추적, 1 추정 |
| [FastAPI가 여러분의 함수를 호출하는 방법](https://oztrkemree.github.io/chalk-talk/gallery/fastapi-request/fastapi-request.html) | fastapi/fastapi | 8/9 추적, 1 추정 |
| [요청이 `app.get()`에 도착하면 일어나는 일](https://oztrkemree.github.io/chalk-talk/gallery/express-request/express-request.html) | expressjs/express | 7/9 추적, 2 추정 |
| [PR #7459: 청크 응답에 ETag가 돌아오다](https://oztrkemree.github.io/chalk-talk/gallery/express-pr/express-pr.html) | expressjs/express | 5/6 추적, 1 추정 |
| [chalk-talk이 모든 화살표를 증명하는 방법](https://oztrkemree.github.io/chalk-talk/skills/chalk-talk/examples/build.html) | 이 저장소 | 6/7 추적, 1 추정 |

`→` / `space` 다음 단계, `P` 재생, `V` 증명 뷰, `T` 라이트/다크. 블록이나 화살표를 클릭하면 해당 코드가 열립니다.

## PR 설명하기

> 이 PR을 chalk talk으로 설명해줘

에이전트가 diff를 읽고 **변경 후의 모습**으로 여정을 들려주면서, 바뀐 부분을 강조합니다: `NEW`, `CHANGED`, `REMOVED`, `PR #7459 · +2 ~4` 칩, 그리고 변경 전후를 오가는 **`D`** 키. GIF를 PR 설명에 넣어두면 리뷰어는 코드를 읽기 전에 변경 사항부터 눈으로 확인합니다.

![변경 모드: Express PR #7459. 변경된 블록은 호박색 테두리, 새 핸들러는 초록색, 모서리에 PR 칩](../media/change-mode.png)

## 설치

**Claude Code**

```
/plugin marketplace add oztrkemree/chalk-talk
/plugin install chalk-talk@chalk-talk
```

**Codex, Cursor, Gemini CLI, OpenCode, Copilot 및 [40개 이상의 다른 에이전트](https://agentskills.io)**

```bash
npx skills add oztrkemree/chalk-talk
```

**직접 설치**: `skills/chalk-talk`을 에이전트의 skills 폴더(`~/.claude/skills/`, `~/.codex/skills/`, ...)에 복사하세요.

스크립트는 Node 18 이상이 필요합니다(Windows, macOS, Linux). 시각적 자체 검사에는 설치된 Chrome, Edge, Brave, Chromium 중 아무거나 사용합니다.

## 사용법

어떤 언어로든 그냥 물어보세요:

> 이 저장소에서 인증은 어떻게 동작해?
>
> 웹훅이 도착하면 무슨 일이 일어나는지 차근차근 설명해줘
>
> 이 PR을 chalk talk으로 설명해줘

또는 직접 호출하세요: `/chalk-talk 결제 흐름`.

에이전트는 `chalk-talks/<name>.scene.json`을 작성하고, `chalk-talks/<name>.html`을 빌드하고, 모든 단계를 스크린샷으로 확인한 뒤 열어줍니다. 씬 파일은 남겨두세요. 수정을 요청하면("3단계를 나눠줘", "재시도 경로도 보여줘") 에이전트가 그 파일을 고칩니다.

| 키 | 동작 |
|---|---|
| `→` / `space` / 클릭 | 다음 단계 |
| `←` | 이전 단계 |
| `P` | 자동 재생 (URL에 `?play=loop`를 붙이면 반복) |
| `V` | 증명 뷰: 어떤 홉이 코드까지 추적됐는지 |
| `D` | PR 토크에서 변경 전 / 후 전환 |
| `C` / 블록이나 화살표 클릭 | 그 뒤에 있는 코드 |
| `T` | 라이트 ↔ 다크 |
| `1`–`9` | 특정 단계로 이동 (URL의 `#3`도 가능) |

휴대폰에서는 보드가 세로 모드로 바뀌고, 각 단계가 다루는 부분을 따라 움직입니다.

## 공유하기

토크는 **HTML 파일 하나**입니다. 서버도 필요 없고, 오프라인에서 동작하며, 누구에게나 보낼 수 있습니다. `CHALK_SHARE=1`을 쓰면 로컬 경로는 빼고 GitHub 영구 링크는 남깁니다.

README, PR, Slack에 바로 넣고 싶나요?

```bash
node skills/chalk-talk/scripts/record.mjs chalk-talks/auth.html --out auth.gif --style chalk
```

`record.mjs`는 설치된 Chrome을 프레임 단위로 구동해서(ffmpeg도, npm 패키지도 필요 없음) 반복 재생되는 GIF를 만듭니다. `--steps 2-5`, `--width 960`, `--theme dark` 옵션도 있습니다.

## 스타일

| | |
|---|---|
| **iso** (기본값) | 아이소메트릭 바닥 위의 작은 3D 블록. 패킷이 도착하면 서버가 깜빡이고, 쓰기가 일어나면 데이터베이스에 물결이 일고, 큐는 찼다가 비워집니다 |
| **chalk** | 같은 보드를 칠판에 분필로 그린 버전. 손으로 그린 선, 파스텔 해칭 |
| **studio** · **blueprint** · **editorial** | 더 큰 시스템을 위한 플랫 카드 레이아웃 |

씬에 `"style": "chalk"`를 넣거나, 아무 토크에나 `?style=chalk`를 붙이세요.

## 작동 원리

```
your question ──▶ agent reads the code ──▶ scene.json ──▶ build.mjs ──▶ talk.html
                                               ▲          (proof check)      │
                                               └──── check.mjs: report + PNG per step
```

씬은 평범한 JSON입니다. 성긴 그리드 위의 노드, 노드 사이의 엣지(그걸 증명하는 코드 포함), 그리고 무엇을 보여주고, 무엇이 흐르고, 무엇을 말할지 정하는 단계들:

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

엔진(HTML 템플릿 하나, 의존성 없음)은 그리드를 아이소메트릭 바닥에 투영하고, 각 노드를 3D 객체로 그리고, 블록을 피해 경로를 잡고, 아무것도 가리지 않는 자리에 라벨을 놓습니다. 스스로 해결하지 못한 문제는 보고하므로(`arrow api -> db runs through cache`) 에이전트가 씬을 고칩니다. 9종의 블록, 37개의 아이콘, 핸드셰이크와 OAuth를 위한 시퀀스 레이아웃, 5가지 스타일. 자세한 내용은 모두 [씬 레퍼런스](../../skills/chalk-talk/references/scene-spec.md)에 있습니다.

에이전트 없이 직접 토크를 빌드할 수도 있습니다:

```bash
node skills/chalk-talk/scripts/build.mjs my-talk.scene.json   # writes my-talk.html, checks proof
node skills/chalk-talk/scripts/check.mjs my-talk.html         # layout report + a PNG per step
```

## FAQ

**그래도 틀릴 수 있나요?** 네. 에이전트가 이야기의 줄기를 잘못 잡거나 지나치게 단순화할 수 있습니다. 하지만 코드에 없는 호출을 주장하는 화살표를 몰래 그릴 수는 없습니다. 그건 `!` 표시와 빌드 경고로 이어집니다. `?` 표시는 토크가 코드 한 줄이 아니라 판단에 기대는 지점을 정확히 보여줍니다.

**제 코드가 어딘가로 전송되나요?** 아니요. chalk-talk은 에이전트가 로컬에서 실행하는 스킬입니다. 페이지는 여러분 디스크에 있는 파일이고, 아무것도 업로드되지 않습니다.

**큰 저장소는요?** 토크 하나에 여정 하나, 블록은 8개 정도. 다음 여정을 요청하면 다음 토크가 나옵니다. 읽을 수 없는 거대한 지도 한 장보다 작고 집중된 토크가 낫습니다.

## 크레딧

- 폰트: Vercel의 [Geist](https://vercel.com/font), IBM의 [IBM Plex](https://www.ibm.com/plex/), [Inter Tight](https://rsms.me/inter/), [Newsreader](https://fonts.google.com/specimen/Newsreader), [Caveat](https://fonts.google.com/specimen/Caveat), [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand). 모두 SIL Open Font License이며, Google Fonts에서 불러오고 번들에는 포함하지 않습니다.
- 단계별로 넘겨보는 아이디어는 Nicky Case의 explorable explanations와 Julia Evans의 zine에서 많은 영향을 받았습니다.

## 라이선스

[MIT](../../LICENSE). 마음껏 쓰고, 포크하고, 배포하세요. 무언가를 이해하는 데 도움이 됐다면, ⭐ 하나가 다른 사람들이 이 프로젝트를 찾는 데 큰 도움이 됩니다.
