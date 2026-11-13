# brutaldiablo.com

The one-page site of Brutal Diablo, a free fan mod of Diablo (1996). Plain HTML and CSS,
no build step, served by GitHub Pages from `main`.

- `index.html` is the whole site; `404.html` sends strays back to it.
- `img/` holds the hero (the owner's cathedral art), the monogram at a few sizes and the
  link-preview image. `favicon.ico` is the monogram.
- The site reads in English, Español (`es/`), Português (`pt-br/`), Čeština (`cs/`), Deutsch (`de/`),
  Русский (`ru/`) and Polski (`pl/`). The English pages are the source; each language's folder is generated from them and
  from its table of translations, `i18n/<language>.json`. Edit the English page or the table, never a
  language folder.
- `CNAME` binds the custom domain. The domain's DNS lives at Websupport.

Fan mod, not affiliated with Blizzard Entertainment.
