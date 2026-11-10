const S = 0.09, LW = 6586, LH = 1988, BASE = 1497, OCX = 2201 + 16 + 720.5, OCY = 1497 - 699.5, OR = 720.5;
sheets['assets/logo-construction.png'] = [1600, 1000, page(1600, 1000, `${hdr('Logo')}
  <div class="tile" style="left:48px;top:90px;width:980px;height:520px;padding:24px 28px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Horizontal lockup, construction</span><span class="cap" style="color:var(--dusk)">C = cap height, 1400 u &nbsp;/&nbsp; clear space C on every side</span></div>
    <div style="position:relative;margin:84px 0 0 ${(924 - LW * S) / 2}px;width:${LW * S}px;height:${LH * S}px">
      <div style="position:absolute;left:${-1400 * S}px;top:${-1400 * S}px;right:${-1400 * S}px;bottom:${-1400 * S}px;border:1.5px dashed #F2600C;border-radius:4px"></div>
      ${sized(lockH, LW * S)}
      <div style="position:absolute;left:-30px;right:-30px;top:${(BASE - 1400) * S}px;height:1px;background:#38B6F2"></div>
      <div style="position:absolute;left:-30px;right:-30px;top:${(BASE - 890) * S}px;height:1px;background:#FFB680"></div>
      <div style="position:absolute;left:-30px;right:-30px;top:${BASE * S}px;height:1px;background:#38B6F2"></div>
      <div style="position:absolute;left:-30px;right:-30px;top:0;height:1px;background:#38B6F2;opacity:.5"></div>
      <div style="position:absolute;left:${1517 * S}px;width:${700 * S}px;top:-30px;bottom:-30px;background:rgba(56,182,242,.16)"></div>
      <div class="cap" style="position:absolute;left:${1517 * S - 10}px;top:-50px;width:${700 * S + 20}px;text-align:center;color:var(--deep-sky)">0.5 C</div>
      <div style="position:absolute;left:${(OCX - OR) * S}px;top:${(OCY - OR) * S}px;width:${2 * OR * S}px;height:${2 * OR * S}px;border-radius:50%;border:1.5px dashed #0A6CA6"></div>
      <div class="cap" style="position:absolute;left:${(OCX - 200) * S}px;width:${400 * S}px;top:${LH * S + 14}px;text-align:center;color:var(--deep-sky);white-space:nowrap;margin-left:-40px">True-circle O</div>
      <div class="cap" style="position:absolute;right:-118px;top:${(BASE - 1400) * S - 7}px;color:var(--deep-sky)">Cap 1400</div>
      <div class="cap" style="position:absolute;right:-118px;top:${(BASE - 890) * S - 7}px;color:var(--ember)">x 890</div>
      <div class="cap" style="position:absolute;right:-118px;top:${BASE * S - 7}px;color:var(--deep-sky)">Base 0</div>
      <div class="cap" style="position:absolute;left:${-1400 * S}px;top:${-1400 * S - 22}px;color:var(--ember)">Clear space C</div>
    </div>
    <div style="position:absolute;left:28px;right:28px;bottom:24px;font-size:14px;line-height:21px;color:var(--dusk)">Wordmark: Fraunces 700, SOFT 100, WONK 0, opsz 144, tracked -0.01 em, kerned O/r -12, r/b +18, b/y +7 per 1000, outlined. The O's outer contour is redrawn as a true circle 1441 u across (cap plus 21 u overshoot top and bottom); its counter is Fraunces' own, so the letter keeps its tilt and reads as a lit sphere in ink. The Orb is 1517 u across: it sits on the baseline with the O's overshoot and its top meets the b ascender. Gap to the O: 0.5 C.</div>
  </div>
  <div class="tile" style="left:1052px;top:90px;width:500px;height:520px;padding:24px 28px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Stacked lockup</span><span class="cap" style="color:var(--dusk)">Orb 2 C, gap 0.5 C</span></div>
    <div style="display:flex;justify-content:center;margin-top:44px">${sized(lockV, 270)}</div>
    <div style="font-size:14px;line-height:21px;color:var(--dusk);margin-top:36px">Splash, store art and anywhere taller than wide. The Orb is centered on the wordmark's ink width and sits 0.5 C above the b ascender.</div>
  </div>
  <div class="tile" style="left:48px;top:630px;width:980px;height:310px;padding:24px 28px">
    <div style="display:flex;justify-content:space-between"><span class="cap">Minimum sizes</span><span class="cap" style="color:var(--dusk)">On screen, in points (width)</span></div>
    <div style="display:flex;gap:56px;align-items:flex-end;margin-top:40px">
      <div style="text-align:center"><div style="height:80px;display:flex;align-items:flex-end;justify-content:center">${sized(lockH, 96)}</div><div class="cap" style="margin-top:12px">Horizontal 96 pt</div></div>
      <div style="text-align:center"><div style="height:80px;display:flex;align-items:flex-end;justify-content:center">${sized(lockV, 56)}</div><div class="cap" style="margin-top:12px">Stacked 56 pt</div></div>
      <div style="text-align:center"><div style="height:80px;display:flex;align-items:flex-end;justify-content:center">${sized(wm, 64)}</div><div class="cap" style="margin-top:12px">Wordmark 64 pt</div></div>
      <div style="text-align:center"><div style="height:80px;display:flex;align-items:flex-end;justify-content:center">${orbSVG(28, { id: 'mn' })}</div><div class="cap" style="margin-top:12px">Gloss Orb 28 pt</div></div>
      <div style="text-align:center"><div style="height:80px;display:flex;align-items:flex-end;justify-content:center"><span style="width:16px;height:16px;border-radius:50%;background:var(--sky)"></span></div><div class="cap" style="margin-top:12px">Flat Orb 16 pt</div></div>
    </div>
    <div style="font-size:14px;line-height:21px;color:var(--dusk);margin-top:26px">Print: horizontal 25 mm wide, stacked 15 mm, wordmark 17 mm. Below these, use the flat Orb alone.</div>
  </div>
  <div class="tile" style="left:1052px;top:630px;width:500px;height:310px;padding:24px 28px;background:var(--twilight);color:#fff">
    <div style="display:flex;justify-content:space-between"><span class="cap" style="color:#fff">On dark grounds</span><span class="cap" style="color:var(--haze)">Paper wordmark, same Orb</span></div>
    <div style="display:flex;justify-content:center;margin-top:62px">${sized(fs.readFileSync(`${D}/assets/lockup-horizontal-paper.svg`, 'utf8'), 300)}</div>
    <div class="cap" style="text-align:center;margin-top:56px;color:var(--haze)">Paper on Twilight 9.33 &nbsp;/&nbsp; on Night Ink 15.88</div>
  </div>
  <div class="foot cap"><span>Files: assets/logo-mark.svg, wordmark-*.svg, lockup-*.svg</span><span>Never retype the wordmark: use the outlined files</span></div>`)];
