<div align="center">

# chalk-talk

### Haritayı okuma. Yolculuğu izle.

Kodlama ajanına *"bu nasıl çalışıyor?"* diye sor; gerçek kod yolunun adım adım, animasyonlu anlatımını tek bir HTML dosyasında al. **Her ok, gerçekleştiği kod satırına kadar izlenir** ya da dürüstçe tahmin olarak işaretlenir.

[**Canlı site ve galeri**](https://oztrkemree.github.io/chalk-talk/) · [Kurulum](#kurulum) · [Kanıt](#her-okun-bir-dayanağı-var) · [PR anlat](#pull-request-anlatımı) · [Sahne formatı](../../skills/chalk-talk/references/scene-spec.md)

![MIT lisansı](https://img.shields.io/badge/license-MIT-blue) ![Tek HTML dosyası](https://img.shields.io/badge/output-one%20HTML%20file-ff5a5f) ![Bağımlılık yok](https://img.shields.io/badge/dependencies-none-2ea44f) ![Agent Skills](https://img.shields.io/badge/Agent%20Skills-Claude%20Code%20%C2%B7%20Codex%20%C2%B7%20Cursor%20%C2%B7%20Gemini-d97757)

[English](../../README.md) · [简体中文](README.zh-CN.md) · [日本語](README.ja.md) · [한국어](README.ko.md) · [Español](README.es.md) · Türkçe

![git commit'in diske ne yazdığı, kara tahtaya çizilmiş hâliyle: nesneler tek tek beliriyor, paketler aralarında dolaşıyor](../media/hero-chalk.gif)

<sub>`git commit`, doğrudan git'in kendi kaynak kodundan anlatılıyor. 9 geçişin 9'u koda kadar izlendi. <a href="https://oztrkemree.github.io/chalk-talk/gallery/git-commit/git-commit.html?style=chalk">Canlı aç →</a></sub>

</div>

## Neden

Diyagramlar ve bilgi grafları sana **neyin var olduğunu** gösterir. Ama bir kod tabanına yeni girdiğinde ya da yapay zekânın yazdığı bir PR'a bakakaldığında asıl soru şudur: **ne oluyor, hangi sırayla ve kodun neresinde**.

chalk-talk bu soruyu, beyaz tahtanın başındaki iyi bir mühendis gibi yanıtlar: her seferinde tek bir şey. İlk kutu, tek bir cümle, bir ok, okun üzerinde ilerleyen bir paket ("`JWT`", "`order #42`", "`SELECT`"). Önceki kısımlar geri planda soluklaşır, yeni kısım parlar. Sonunda tüm yolculuk baştan oynatılır. Herhangi bir bloğa ya da oka tıkla, ilgili satırlar GitHub kalıcı bağlantısıyla birlikte açılsın.

Ajanın küçücük bir sahne dosyası yazar. Yerleşimi, yol çizimini, 3D çizimi ve animasyonu motor halleder; ardından her adımın ekran görüntüsünü alır ki ajan, sen görmeden önce kendi işini kontrol edebilsin.

## Her okun bir dayanağı var

Yanlış bir animasyonlu diyagram, hiç diyagram olmamasından daha kötüdür: *daha ikna edici* bir halüsinasyondur. Bu yüzden chalk-talk'ta bir ok sadece çizilmez. **Kaynağı gösterilir**:

```json
{ "from": "router", "to": "layer", "label": "match(path)",
  "code": "router/index.js:230-247", "calls": "matchLayer(layer, path)" }
```

Build dosyayı açar, o satırları okur ve `matchLayer(layer, path)` gerçekten orada mı diye kontrol eder. Sonra her ok bir işaret alır:

| işaret | anlamı |
|---|---|
| ✓ **verified** (doğrulandı) | alıntılanan satırlar var ve çağrıyı içeriyor |
| **?** **inferred** (çıkarım) | gösterilecek bir satır yok (ağ sınırı, dinamik dispatch); gerekçesiyle birlikte |
| **!** **broken** (kırık) | çağrı o satırlarda yok. Build uyarır, ajan düzeltir |

```
$ node scripts/build.mjs express-request.scene.json
proof: 7/9 hops traced to code (7 verified, 0 cited) · 2 inferred · 0 broken
```

Herhangi bir anlatımda **`V`** tuşuna bas, hangi geçişlerin kanıtlandığını gör. Kapanış özeti de bunu açıkça söyler: *"7 of 9 hops traced to code · 2 inferred"*.

![Kanıt görünümü: Express 5 istek yolculuğu; kanıtlanan her okta onay işareti, çıkarım yapılan iki geçiş soru işaretli noktalı çizgiyle](../media/proof-view.png)

## Galeri

Aşağıdaki her anlatımı bir ajan gerçek kaynak koddan yazdı ve her ok kontrol edildi.

| anlatım | repo | kanıt |
|---|---|---|
| [git commit diske ne yazar](https://oztrkemree.github.io/chalk-talk/gallery/git-commit/git-commit.html) | git/git | 9/9 izlendi |
| [Codex CLI bir shell komutunu nasıl çalıştırır](https://oztrkemree.github.io/chalk-talk/gallery/codex-exec/codex-exec.html) | openai/codex | 10/10 izlendi |
| [Vite bir modülü nasıl anında günceller (HMR)](https://oztrkemree.github.io/chalk-talk/gallery/vite-hmr/vite-hmr.html) | vitejs/vite | 7/8 izlendi, 1 çıkarım |
| [Redis `SET greeting hello` ile ne yapar](https://oztrkemree.github.io/chalk-talk/gallery/redis-set/redis-set.html) | redis/redis | 8/9 izlendi, 1 çıkarım |
| [FastAPI senin fonksiyonunu nasıl çağırır](https://oztrkemree.github.io/chalk-talk/gallery/fastapi-request/fastapi-request.html) | fastapi/fastapi | 8/9 izlendi, 1 çıkarım |
| [Bir istek `app.get()`'e ulaştığında ne olur](https://oztrkemree.github.io/chalk-talk/gallery/express-request/express-request.html) | expressjs/express | 7/9 izlendi, 2 çıkarım |
| [PR #7459: chunked yanıtlar ETag'lerine kavuşuyor](https://oztrkemree.github.io/chalk-talk/gallery/express-pr/express-pr.html) | expressjs/express | 5/6 izlendi, 1 çıkarım |
| [chalk-talk her oku nasıl kanıtlar](https://oztrkemree.github.io/chalk-talk/skills/chalk-talk/examples/build.html) | bu repo | 6/7 izlendi, 1 çıkarım |

`→` / `space` ilerler, `P` oynatır, `V` kanıt görünümü, `T` açık/koyu; kodunu görmek için bir bloğa ya da oka tıkla.

## Pull request anlatımı

> bu PR'ı chalk talk ile anlat

Ajan diff'i okur ve yolculuğu **değişiklikten sonraki hâliyle** anlatır, değişenleri de öne çıkarır: `NEW`, `CHANGED`, `REMOVED`, bir `PR #7459 · +2 ~4` rozeti ve önce/sonra arasında geçiş için **`D`**. GIF'i PR açıklamasına koy; inceleyenler değişikliği okumadan önce görsün.

![Değişiklik modu: Express PR #7459; değişen bloklar kehribar renkli halkayla, yeni handler yeşille, PR rozeti köşede](../media/change-mode.png)

## Kurulum

**Claude Code**

```
/plugin marketplace add oztrkemree/chalk-talk
/plugin install chalk-talk@chalk-talk
```

**Codex, Cursor, Gemini CLI, OpenCode, Copilot ve [40'tan fazla başka ajan](https://agentskills.io)**

```bash
npx skills add oztrkemree/chalk-talk
```

**Elle**: `skills/chalk-talk` klasörünü ajanının skills klasörüne kopyala (`~/.claude/skills/`, `~/.codex/skills/`, ...).

Script'ler Node 18+ ister (Windows, macOS, Linux). Görsel öz-kontrol, kurulu herhangi bir Chrome, Edge, Brave veya Chromium'u kullanır.

## Kullanım

Sadece sor, hangi dilde istersen:

> bu repoda auth nasıl çalışıyor?
>
> bir webhook geldiğinde neler olduğunu adım adım anlat
>
> bu PR'ı chalk talk ile anlat
>
> bu kuyruk sistemi nasıl çalışıyor, çizerek anlat

ya da doğrudan çağır: `/chalk-talk ödeme akışı`.

Ajan `chalk-talks/<name>.scene.json` dosyasını yazar, `chalk-talks/<name>.html` dosyasını build eder, her adımı ekran görüntüsüyle kontrol eder ve açar. Sahne dosyasını sakla: değişiklik iste ("3. adımı böl", "yeniden deneme yolunu göster"), ajan onu düzenlesin.

| tuş | ne yapar |
|---|---|
| `→` / `space` / tıklama | sonraki adım |
| `←` | önceki adım |
| `P` | otomatik oynatma (URL'de `?play=loop` döngüye alır) |
| `V` | kanıt görünümü: hangi geçişler koda kadar izlendi |
| `D` | PR anlatımında önce / sonra |
| `C` / bir bloğa ya da oka tıklama | arkasındaki kod |
| `T` | açık ↔ koyu |
| `1`–`9` | bir adıma atla (URL'de `#3` de olur) |

Telefonda tahta dikey moda geçer ve her adımın anlattığı kısmı takip eder.

## Paylaş

Bir anlatım **tek bir HTML dosyasıdır**: sunucu yok, çevrimdışı çalışır, istediğin kişiye gönder. `CHALK_SHARE=1` yerel yollarını dışarıda bırakır, GitHub kalıcı bağlantılarını korur.

README'ye, PR'a ya da Slack'e doğrudan gömmek mi istiyorsun?

```bash
node skills/chalk-talk/scripts/record.mjs chalk-talks/auth.html --out auth.gif --style chalk
```

`record.mjs` kurulu Chrome'unu kare kare yönetir (ffmpeg yok, npm paketi yok) ve döngüde oynayan bir GIF yazar. `--steps 2-5`, `--width 960`, `--theme dark` seçenekleri de var.

## Stiller

| | |
|---|---|
| **iso** (varsayılan) | izometrik bir zemin üzerinde küçük 3D bloklar; paket ulaştığında sunucular yanıp söner, yazma anında veritabanları dalgalanır, kuyruklar dolup boşalır |
| **chalk** | aynı tahta, kara tahtaya tebeşirle çizilmiş hâli: el çizimi hatlar, pastel taramalar |
| **studio** · **blueprint** · **editorial** | büyük sistemler için düz kart yerleşimleri |

Sahnede `"style": "chalk"`, ya da herhangi bir anlatımda `?style=chalk`.

## Nasıl çalışır

```
your question ──▶ agent reads the code ──▶ scene.json ──▶ build.mjs ──▶ talk.html
                                               ▲          (proof check)      │
                                               └──── check.mjs: report + PNG per step
```

Sahne düz bir JSON'dur: kaba bir ızgara üzerindeki düğümler, aralarındaki kenarlar (onları kanıtlayan kodla birlikte) ve neyin gösterileceğini, neyin akacağını, ne söyleneceğini belirten adımlar:

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

Motor (tek bir HTML şablonu, bağımlılık yok) ızgarayı izometrik bir zemine yansıtır, her düğümü 3D bir nesne olarak çizer, yolları blokların etrafından dolaştırır, etiketleri hiçbir şeyi kapatmayacak yerlere koyar ve düzeltemediği şeyi raporlar (`arrow api -> db runs through cache`), böylece ajan sahneyi değiştirir. Dokuz blok türü, 37 ikon, el sıkışmalar ve OAuth için bir sıralı (sequence) yerleşim, beş stil. Her şey [sahne referansında](../../skills/chalk-talk/references/scene-spec.md).

Ajana gerek kalmadan, bir anlatımı elle build et:

```bash
node skills/chalk-talk/scripts/build.mjs my-talk.scene.json   # writes my-talk.html, checks proof
node skills/chalk-talk/scripts/check.mjs my-talk.html         # layout report + a PNG per step
```

## SSS

**Yine de yanılabilir mi?** Evet: ajan yanlış hikâyeyi seçebilir ya da fazla basitleştirebilir. Ama kodda olmayan bir çağrıyı iddia eden bir oku sessizce çizemez: bu bir `!` ve bir build uyarısı demektir. `?` işaretleri, anlatımın tam olarak nerede bir satıra değil yoruma dayandığını gösterir.

**Kodum bir yere gönderiliyor mu?** Hayır. chalk-talk, ajanının yerelde çalıştırdığı bir skill. Sayfa diskindeki bir dosya; hiçbir şey yüklenmez.

**Büyük repolar?** Anlatım başına tek bir yolculuk, yaklaşık 8 blok. Sonraki yolculuğu iste, sonraki anlatımı al. Küçük ve odaklı anlatımlar, okunamayan tek bir haritadan iyidir.

## Teşekkürler

- Fontlar: Vercel'den [Geist](https://vercel.com/font), IBM'den [IBM Plex](https://www.ibm.com/plex/), [Inter Tight](https://rsms.me/inter/), [Newsreader](https://fonts.google.com/specimen/Newsreader), [Caveat](https://fonts.google.com/specimen/Caveat) ve [Patrick Hand](https://fonts.google.com/specimen/Patrick+Hand); hepsi SIL Open Font License altında, Google Fonts'tan yüklenir, pakete dahil edilmez.
- Adım adım ilerleme fikri, Nicky Case'in explorable explanations çalışmalarına ve Julia Evans'ın zine'lerine çok şey borçlu.

## Lisans

[MIT](../../LICENSE). Kullan, fork'la, yayınla. Bir şeyi anlamana yardımcı olduysa, bir ⭐ başkalarının da onu bulmasına yardımcı olur.
