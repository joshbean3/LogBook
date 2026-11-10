// ---------------- app icon on the Home Screen ----------------
const ic = (f, size) => `<div style="width:${size}px;height:${size}px;border-radius:${size * 0.2237}px;overflow:hidden;box-shadow:0 0 0 0.5px rgba(14,34,54,.12)"><img src="${A(f)}" width="${size}" height="${size}" style="display:block"></div>`;
const homeRow = (f, bg, labelColor, title, sub) => `<div style="position:relative;border-radius:24px;overflow:hidden;height:600px;background:${bg};display:flex;flex-direction:column;align-items:center;justify-content:center">
  <div style="display:grid;grid-template-columns:repeat(4,76px);gap:28px 26px;opacity:.95">
    ${[0, 1, 2].map(() => `<div style="text-align:center"><div style="width:76px;height:76px;border-radius:17px;background:rgba(255,255,255,.18);box-shadow:inset 0 0 0 1px rgba(255,255,255,.18)"></div><div style="height:16px"></div></div>`).join('')}
    <div style="text-align:center">${ic(f, 76)}<div style="font:500 12px/16px Inter;color:${labelColor};margin-top:6px">Orby</div></div>
  </div>
  <div style="margin-top:56px">${ic(f, 180)}</div>
  <div class="cap" style="margin-top:22px;color:${labelColor}">${title}</div>
  <div class="cap" style="margin-top:6px;color:${labelColor};opacity:.8">${sub}</div>
</div>`;
sheets['assets/app-icon-homescreen.png'] = [1600, 1000, page(1600, 1000, `${hdr('App icon')}
  <div class="tile" style="left:48px;top:90px;width:1504px;height:850px;padding:24px 28px">
    <div style="display:flex;justify-content:space-between"><span class="cap">On the Home Screen, display name Orby</span><span class="cap" style="color:var(--dusk)">Supply 1024 px, square, opaque. iOS applies the mask</span></div>
    <div style="display:grid;grid-template-columns:repeat(3,1fr);gap:24px;margin-top:26px">
      ${homeRow('app-icon-1024.png', 'linear-gradient(180deg,#7DB8DE,#C9DDEA 60%,#E9D6C4)', '#0E2236', 'Light', 'Morning sky, the tinted Orb, two hills')}
      ${homeRow('app-icon-dark-1024.png', 'linear-gradient(180deg,#0B1726,#16304A)', '#FFFFFF', 'Dark', 'Night Ink to Twilight, the same Orb')}
      ${homeRow('app-icon-tinted-1024.png', 'linear-gradient(180deg,#2A3440,#11161C)', '#FFFFFF', 'Tinted', 'Greyscale source, iOS tints it')}
    </div>
    <div style="font-size:14px;line-height:21px;color:var(--dusk);margin-top:22px">The label under the icon is CFBundleDisplayName "Orby". The bundle id stays com.joshbean.logbook. The Orb is 51% of the canvas (520 of 1024 px), centered 34 px above the middle, so it survives the mask and the small sizes.</div>
  </div>
  <div class="foot cap"><span>Files: assets/app-icon-1024.png, app-icon-dark-1024.png, app-icon-tinted-1024.png and their -source.svg</span><span>No text, no transparency, no corners</span></div>`)];
