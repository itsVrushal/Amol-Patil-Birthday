# 🎞️ Father's Tribute Website

A beautiful, minimal tribute site with **horizontal parallax scrolling** and **3-layer depth effect**.

---

## 🚀 Quick Start

```bash
# 1. Start dev server
npm run dev
# → Opens at http://localhost:3000
```

---

## 🖼️ Regenerate Cutouts (after adding new images)

```bash
python scripts/remove_bg.py          # process new images only
python scripts/remove_bg.py --force  # re-process everything
```

**Requirements** (already installed):
```bash
python -m pip install onnxruntime pillow tqdm numpy
```

---

## ✏️ Editing Content — `config.json`

Everything is controlled from **`config.json`** in the project root.
When you edit `config.json` while `npm run dev` is running, the browser automatically updates instantly via Hot Module Reloading (no server restart or manual copying needed).

### Change the site title / name
```json
"site": {
  "title": { "en": "Your Name", "mr": "तुमचे नाव" },
  "subtitle": { "en": "A subtitle", "mr": "उपशीर्षक" }
}
```

### Add or Customize a Slide
Each slide can be positioned and fine-tuned right from `config.json`:

```json
{
  "id": "slide-1",
  "backgroundImage": "DSC00049.JPG",
  "cutoutImage": "DSC00049_cutout.png",
  "title": { "en": "The Beginning", "mr": "सुरुवात" },
  "caption": { "en": "Every great story has a beginning.", "mr": "प्रत्येक महान कथेची एक सुरुवात असते." },
  "year": "2020",
  "textPosition": "left",
  "cutoutPosition": "right",
  "cutoutScale": 1.0,
  "parallaxIntensity": 1.6
}
```

#### Positioning Options in `config.json`:
* **`textPosition`**: `"left"` | `"right"` | `"center"` | `"top-left"` | `"top-right"` | `"bottom-left"` | `"bottom-right"`
  * Can also be a custom coordinates object: `{ "left": "10vw", "top": "30%", "align": "left" }`
* **`cutoutPosition`**: `"right"` | `"left"` | `"center"` | `"bottom-right"` | `"bottom-left"` | `"bottom-center"`
  * Can also be a custom coordinates object: `{ "right": "5vw", "bottom": "0" }`
* **`cutoutScale`**: Number factor, e.g. `0.9` (smaller), `1.0` (standard), `1.15` (larger)
* **`cutoutOffset`**: `{ "x": 0, "y": 0 }` (offset in px or string like `"-5vw"`)
* **`textOffset`**: `{ "x": 0, "y": 0 }`
* **`parallaxIntensity`**: e.g. `1.0` to `2.2` (higher = deeper, more dramatic 3D parallax movement)

### Inactivity Auto-Scroll
Under `"ui"` in `config.json`:
```json
"ui": {
  "autoScrollSeconds": 10
}
```
If the user does not scroll or interact for 10 seconds, the slideshow will automatically and smoothly advance to the next slide! Any user scroll or click immediately resets the 10-second timer.

### Change / add music
1. Drop `.mp3` file into `public/music/`
2. Update `config.json`:
```json
"music": {
  "tracks": [
    { "id": "track-1", "title": "My Song", "file": "music/mysong.mp3" }
  ],
  "defaultTrack": "track-1"
}
```

### Switch default language
```json
"site": { "defaultLanguage": "mr" }
```

---

## 🗂️ Project Structure

```
├── config.json          ← ✏️ EDIT THIS! Single file for all content, text & images
├── index.html
├── src/
│   ├── main.js          ← App entry, Lenis scroll, keyboard nav
│   ├── loader.js        ← Opening stack-of-cards animation
│   ├── parallax.js      ← GSAP 3-layer parallax engine
│   ├── slides.js        ← Builds slide DOM from config
│   ├── i18n.js          ← EN / Marathi language switching
│   ├── music.js         ← Music player (loop, progress bar)
│   └── style.css        ← All styles
├── scripts/
│   ├── remove_bg.py     ← AI background removal (U2Net ONNX)
│   └── optimize_images.py ← Resizes & optimizes photos
├── public/
│   ├── images/
│   │   ├── originals/   ← Optimized JPEGs (background layer)
│   │   └── cutouts/     ← AI-removed PNGs (foreground layer)
│   └── music/           ← Drop .mp3 / .wav files here
└── img_Dir/             ← Original photos (source)
```

---

## ⌨️ Keyboard Navigation
- `→` / `↓` — Next slide
- `←` / `↑` — Previous slide
- Click dots at the bottom to jump to any slide

---

## 🎵 Music
- Click the **♪ icon** (top left) to toggle music on/off
- Music loops automatically when it ends
- Add multiple tracks to `config.json` to cycle through them

---

## 🌐 Language Toggle
- Click **EN | मर** (top right) to switch between English and Marathi
- All text updates instantly — no page reload

---

## 🏗️ Build for Production
```bash
npm run build
# Output in dist/ — ready to deploy to any static host
```
