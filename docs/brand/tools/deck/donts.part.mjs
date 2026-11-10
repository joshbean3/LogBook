sheets['assets/logo-donts.png'] = [1600, 1000, page(1600, 1000, `${hdr('Logo misuse')}
  <div class="tile" style="left:48px;top:90px;width:1504px;height:850px;padding:24px 28px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Never do these</span><span class="cap" style="color:var(--dusk)">Use the supplied files. Each tile breaks one rule</span></div>
    <div style="display:grid;grid-template-columns:repeat(5,1fr);gap:22px;margin-top:26px">
      ${dont(`<div style="transform:scaleX(1.35)">${sized(lockH, 190)}</div>`, 'Stretch or squash')}
      ${dont(`<div style="display:flex;align-items:center;gap:12px">${orbSVG(40, { id: 'd1' })}<span style="font:700 40px Inter;letter-spacing:-.02em;color:#0E2236">Orby</span></div>`, 'Retype it in another face')}
      ${dont(`<div style="display:flex;align-items:center;gap:2px">${orbSVG(62, { id: 'd0' })}<svg viewBox="2700 -1497 2700 1988" width="${2700 * 0.042}"><path fill="#0E2236" d="${(fs.readFileSync(`${D}/assets/wordmark-ink.svg`, 'utf8').match(/ d="([^"]+)"/) || [])[1]}"/></svg></div>`, 'Swap the O for the Orb')}
      ${dont(`<span class="d" style="font-size:44px;font-weight:700;letter-spacing:.06em;color:#0E2236">ORBY</span>`, 'Set the name in caps')}
      ${dont(`<div style="filter:hue-rotate(160deg)">${sized(lockH, 210)}</div>`, 'Recolor the Orb')}
      ${dont(`<svg width="80" height="80" viewBox="0 0 100 100"><circle cx="50" cy="50" r="48" fill="#F2600C"/><circle cx="50" cy="50" r="48" fill="#38B6F2" clip-path="inset(0 0 50% 0)"/></svg>`, 'A two-tone ball')}
      ${dont(`<div style="display:flex;align-items:center;gap:6px">${orbSVG(46, { id: 'd2' })}${orbSVG(46, { id: 'd3' })}</div>`, 'Two Orbs on one screen')}
      ${dont(`<div style="background:linear-gradient(135deg,#F2600C,#38B6F2);padding:22px 16px;border-radius:12px">${sized(lockH, 190)}</div>`, 'Busy or clashing grounds')}
      ${dont(`<div style="position:relative">${orbSVG(80, { id: 'd4' })}<svg width="80" height="80" viewBox="0 0 100 100" style="position:absolute;left:3px;top:3px"><circle cx="38" cy="44" r="5" fill="#0E2236"/><circle cx="62" cy="44" r="5" fill="#0E2236"/><path d="M36 62q14 12 28 0" stroke="#0E2236" stroke-width="4" fill="none" stroke-linecap="round"/></svg></div>`, 'Give it a face')}
      ${dont(`<div style="display:flex;align-items:center;gap:10px"><span style="width:40px;height:40px;border-radius:50%;background:#38B6F2;box-shadow:0 8px 14px rgba(0,0,0,.45)"></span><span style="filter:drop-shadow(3px 4px 2px rgba(0,0,0,.4))">${sized(wm, 120)}</span></div>`, 'Drop shadows or bevels')}
      ${dont(`${sized(lockH, 210).replace(/fill="#0E2236"/, 'fill="#46596D"')}`, 'Grey or tinted wordmark')}
      ${dont(`<div style="display:flex;align-items:center;gap:40px">${orbSVG(40, { id: 'd5' })}${sized(wm, 110)}</div>`, 'Change the spacing')}
      ${dont(`<div style="transform:rotate(-14deg)">${sized(lockH, 200)}</div>`, 'Rotate or tilt')}
      ${dont(`<div style="text-align:left;font-size:17px;line-height:24px;color:#0E2236;padding:0 18px">Open <b>the Orby app</b> and log your run.</div>`, 'Say "the Orby" or "Orby app"')}
      ${dont(`<div style="outline:2px solid #0E2236;outline-offset:10px;border-radius:2px">${sized(lockH, 190)}</div>`, 'Box it or add rules')}
    </div></div>
  <div class="foot cap"><span>Use the files as supplied</span><span>Questions: brand-guide.md section 2.7</span></div>`)];
