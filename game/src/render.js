// Drawing only: the world state in, pixels out. Top-down canvas art —
// roads, buildings, water, the harbour, cars with headlights, the HUD,
// the minimap, dialogue, and the title / pause / busted / victory screens.
// Nothing here decides rules; it only paints what the world says is there.
import { FONT, HARBOR, PALETTE, PARK, ROADS_X, ROADS_Y, ROAD_W, SPRAY, WORLD } from './config.js';
import { districtAt } from './world.js';

function clamp(v, min, max) { return v < min ? min : v > max ? max : v; }

export function createRenderer(canvas) {
  const ctx = canvas.getContext('2d');

  function resize() {
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    const w = canvas.clientWidth || window.innerWidth;
    const h = canvas.clientHeight || window.innerHeight;
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    return { w, h };
  }

  function darkness(clockMin) {
    const h = clockMin / 60;
    if (h >= 10 && h <= 16) return 0;
    if (h >= 21 || h <= 5) return 0.45;
    if (h > 16 && h < 21) return 0.45 * (h - 16) / 5;
    return 0.45 * (1 - (h - 5) / 5);
  }

  function drawCar(c, time) {
    ctx.save();
    ctx.translate(c.x, c.y);
    ctx.rotate(c.angle);
    if (c.dead) ctx.globalAlpha = 0.55;
    ctx.fillStyle = '#111';
    ctx.fillRect(-25, -13, 50, 26);
    ctx.fillStyle = c.color;
    ctx.fillRect(-23, -11, 46, 22);
    ctx.fillStyle = 'rgba(180,220,255,0.85)';
    ctx.fillRect(2, -9, 9, 18);
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(-12, -9, 10, 18);
    if (c.police) {
      const flash = Math.floor(time * 4) % 2 === 0;
      ctx.fillStyle = flash ? '#ff3b30' : '#3b82ff';
      ctx.fillRect(-6, -11, 12, 5);
      ctx.fillStyle = flash ? '#3b82ff' : '#ff3b30';
      ctx.fillRect(-6, 6, 12, 5);
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 7px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('SBPD', 0, 3);
    }
    ctx.fillStyle = '#ffe9a8';
    ctx.fillRect(21, -9, 3, 4);
    ctx.fillRect(21, 5, 3, 4);
    ctx.restore();
  }

  function drawWorld(s, view, time) {
    const cam = s.camera;
    const shakeX = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
    const shakeY = s.shake > 0 ? (Math.random() - 0.5) * s.shake : 0;
    const ox = -cam.x + shakeX;
    const oy = -cam.y + shakeY;
    ctx.save();
    ctx.translate(ox, oy);

    // Ground, harbour water, park grass.
    ctx.fillStyle = PALETTE.grass;
    ctx.fillRect(cam.x - 20, cam.y - 20, view.w + 40, view.h + 40);
    ctx.fillStyle = PALETTE.water;
    ctx.fillRect(HARBOR.x, HARBOR.y, HARBOR.w, HARBOR.h);
    ctx.fillStyle = '#1d4258';
    for (let y = 240; y < WORLD.height; y += 340) {
      ctx.fillRect(20, y, 100, 14);
      ctx.fillRect(46, y + 60, 74, 10);
    }
    ctx.fillStyle = PALETTE.parkGrass;
    ctx.fillRect(PARK.x, PARK.y, PARK.w, PARK.h);

    // Roads.
    ctx.fillStyle = PALETTE.road;
    for (const rx of ROADS_X) ctx.fillRect(rx - ROAD_W / 2, 0, ROAD_W, WORLD.height);
    for (const ry of ROADS_Y) ctx.fillRect(0, ry - ROAD_W / 2, WORLD.width, ROAD_W);
    // Centre dashes.
    ctx.fillStyle = PALETTE.roadLine;
    for (const rx of ROADS_X) {
      for (let y = 0; y < WORLD.height; y += 64) ctx.fillRect(rx - 2, y, 4, 30);
    }
    for (const ry of ROADS_Y) {
      for (let x = 0; x < WORLD.width; x += 64) ctx.fillRect(x, ry - 2, 30, 4);
    }

    // Pay-and-spray garage.
    ctx.fillStyle = '#8a6d2f';
    ctx.fillRect(SPRAY.x - 70, SPRAY.y - 50, 140, 100);
    ctx.fillStyle = '#ffd34d';
    ctx.font = 'bold 13px ' + FONT;
    ctx.textAlign = 'center';
    ctx.fillText('SPRAY $200', SPRAY.x, SPRAY.y - 58);
    ctx.strokeStyle = '#ffd34d';
    ctx.lineWidth = 3;
    ctx.beginPath();
    ctx.arc(SPRAY.x, SPRAY.y, SPRAY.radius, 0, Math.PI * 2);
    ctx.stroke();

    // Buildings.
    for (const b of s.buildings) {
      if (b.x > cam.x + view.w + 60 || b.x + b.w < cam.x - 60 || b.y > cam.y + view.h + 60 || b.y + b.h < cam.y - 60) continue;
      ctx.fillStyle = b.color;
      ctx.fillRect(b.x, b.y, b.w, b.h);
      ctx.fillStyle = b.roof;
      ctx.fillRect(b.x + 6, b.y + 6, b.w - 12, b.h - 12);
      ctx.fillStyle = 'rgba(255,220,120,0.75)';
      const cols = Math.max(1, Math.floor(b.w / 34));
      const rows = Math.max(1, Math.floor(b.h / 34));
      for (let i = 0; i < cols; i += 1) {
        for (let j = 0; j < rows; j += 1) {
          if ((i * 7 + j * 3 + Math.floor(b.x)) % 3 === 0) {
            ctx.fillRect(b.x + 12 + i * 34, b.y + 12 + j * 34, 10, 12);
          }
        }
      }
      if (b.tall) {
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.fillRect(b.x + b.w - 8, b.y + 8, 8, b.h - 16);
      }
    }

    // Trees.
    for (const t of s.trees) {
      if (t.x < cam.x - 30 || t.x > cam.x + view.w + 30 || t.y < cam.y - 30 || t.y > cam.y + view.h + 30) continue;
      ctx.fillStyle = '#1e5c2a';
      ctx.beginPath();
      ctx.arc(t.x, t.y, t.s, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#2f8f3f';
      ctx.beginPath();
      ctx.arc(t.x - 3, t.y - 3, t.s * 0.6, 0, Math.PI * 2);
      ctx.fill();
    }

    // Mission target beacon.
    const t = s.target;
    if (t && s.mode === 'play') {
      const pulse = 1 + Math.sin(time * 4) * 0.15;
      ctx.save();
      ctx.translate(t.x, t.y);
      ctx.scale(pulse, pulse);
      ctx.strokeStyle = '#ffd34d';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(0, -26);
      ctx.lineTo(18, 0);
      ctx.lineTo(0, 26);
      ctx.lineTo(-18, 0);
      ctx.closePath();
      ctx.stroke();
      ctx.fillStyle = 'rgba(255,211,77,0.25)';
      ctx.beginPath();
      ctx.arc(0, 0, 34, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
      ctx.fillStyle = 'rgba(255,211,77,0.9)';
      ctx.beginPath();
      ctx.arc(t.x, t.y, 4, 0, Math.PI * 2);
      ctx.fill();
    }

    // Pedestrians.
    for (const ped of s.peds) {
      ctx.fillStyle = PALETTE.ped;
      ctx.beginPath();
      ctx.arc(ped.x, ped.y, 7, 0, Math.PI * 2);
      ctx.fill();
      ctx.fillStyle = '#333';
      ctx.beginPath();
      ctx.arc(ped.x + Math.cos(ped.angle) * 4, ped.y + Math.sin(ped.angle) * 4, 3, 0, Math.PI * 2);
      ctx.fill();
    }

    // Enemies (Harlow crew red, Dario purple and bigger).
    for (const e of s.enemies) {
      const r = e.kind === 'dario' ? 15 : 11;
      ctx.fillStyle = e.kind === 'dario' ? PALETTE.dario : PALETTE.goon;
      ctx.beginPath();
      ctx.arc(e.x, e.y, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#000';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(e.x, e.y);
      ctx.lineTo(e.x + Math.cos(e.angle) * (r + 12), e.y + Math.sin(e.angle) * (r + 12));
      ctx.stroke();
      // Health bar.
      ctx.fillStyle = 'rgba(0,0,0,0.6)';
      ctx.fillRect(e.x - 16, e.y - r - 12, 32, 5);
      ctx.fillStyle = '#e5534b';
      ctx.fillRect(e.x - 16, e.y - r - 12, 32 * Math.max(0, e.hp / (e.kind === 'dario' ? 300 : 60)), 5);
      if (e.kind === 'dario') {
        ctx.fillStyle = '#fff';
        ctx.font = 'bold 11px ' + FONT;
        ctx.textAlign = 'center';
        ctx.fillText('DARIO', e.x, e.y - r - 16);
      }
    }

    // Cars (player's car last, so it sits on top).
    for (const c of s.cars) {
      if (c === s.player.car) continue;
      if (c.x < cam.x - 80 || c.x > cam.x + view.w + 80 || c.y < cam.y - 80 || c.y > cam.y + view.h + 80) continue;
      drawCar(c, time);
    }
    if (s.player.inCar && s.player.car) drawCar({ ...s.player.car, color: PALETTE.playerCar }, time);

    // Mara on foot.
    if (!s.player.inCar) {
      const p = s.player;
      ctx.fillStyle = PALETTE.player;
      ctx.beginPath();
      ctx.arc(p.x, p.y, 13, 0, Math.PI * 2);
      ctx.fill();
      ctx.strokeStyle = '#111';
      ctx.lineWidth = 2;
      ctx.stroke();
      ctx.strokeStyle = '#222';
      ctx.lineWidth = 4;
      ctx.beginPath();
      ctx.moveTo(p.x, p.y);
      ctx.lineTo(p.x + Math.cos(p.aimAngle) * 24, p.y + Math.sin(p.aimAngle) * 24);
      ctx.stroke();
      ctx.fillStyle = '#fff';
      ctx.font = 'bold 10px ' + FONT;
      ctx.textAlign = 'center';
      ctx.fillText('MARA', p.x, p.y - 20);
    }

    // Bullets and particles.
    ctx.fillStyle = '#ffe9a8';
    for (const b of s.bullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff6b5e';
    for (const b of s.ebullets) {
      ctx.beginPath();
      ctx.arc(b.x, b.y, 3, 0, Math.PI * 2);
      ctx.fill();
    }
    for (const pt of s.particles) {
      ctx.globalAlpha = Math.max(0, pt.life / pt.max);
      ctx.fillStyle = pt.color;
      ctx.beginPath();
      ctx.arc(pt.x, pt.y, pt.size, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    ctx.restore();

    // Night falls over the city.
    const dark = darkness(s.clockMin);
    if (dark > 0.01) {
      ctx.fillStyle = `rgba(8,10,28,${dark.toFixed(3)})`;
      ctx.fillRect(0, 0, view.w, view.h);
    }
    // Rain streaks across the screen.
    if (s.rain > 0.02) {
      ctx.strokeStyle = `rgba(170,200,230,${(0.35 * s.rain).toFixed(3)})`;
      ctx.lineWidth = 1;
      ctx.beginPath();
      const n = Math.floor(90 * s.rain);
      for (let i = 0; i < n; i += 1) {
        const rx = ((i * 137.5 + time * 340) % (view.w + 40)) - 20;
        const ry = ((i * 89.3 + time * 700) % (view.h + 40)) - 20;
        ctx.moveTo(rx, ry);
        ctx.lineTo(rx - 4, ry + 14);
      }
      ctx.stroke();
    }
  }

  function drawMinimap(s, view, yOff) {
    const mw = 210;
    const mh = 160;
    const x0 = view.w - mw - 14;
    const y0 = view.h - mh - 14 + (yOff || 0);
    const sx = mw / WORLD.width;
    const sy = mh / WORLD.height;
    ctx.fillStyle = 'rgba(8,10,16,0.78)';
    ctx.fillRect(x0 - 4, y0 - 4, mw + 8, mh + 8);
    ctx.fillStyle = '#22303a';
    ctx.fillRect(x0, y0, mw, mh);
    ctx.strokeStyle = '#5a6a78';
    ctx.lineWidth = 1;
    for (const rx of ROADS_X) {
      ctx.beginPath();
      ctx.moveTo(x0 + rx * sx, y0);
      ctx.lineTo(x0 + rx * sx, y0 + mh);
      ctx.stroke();
    }
    for (const ry of ROADS_Y) {
      ctx.beginPath();
      ctx.moveTo(x0, y0 + ry * sy);
      ctx.lineTo(x0 + mw, y0 + ry * sy);
      ctx.stroke();
    }
    ctx.fillStyle = '#2f8f3f';
    ctx.fillRect(x0 + PARK.x * sx, y0 + PARK.y * sy, PARK.w * sx, PARK.h * sy);
    const t = s.target;
    if (t && s.mode === 'play') {
      ctx.fillStyle = '#ffd34d';
      ctx.beginPath();
      ctx.arc(x0 + t.x * sx, y0 + t.y * sy, 5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.fillStyle = '#ff3b30';
    for (const c of s.cars) {
      if (c.police && !c.dead) {
        ctx.fillRect(x0 + c.x * sx - 2, y0 + c.y * sy - 2, 4, 4);
      }
    }
    // Mara, as a yellow arrow.
    const p = s.player;
    ctx.save();
    ctx.translate(x0 + p.x * sx, y0 + p.y * sy);
    ctx.rotate(p.angle);
    ctx.fillStyle = '#ffd34d';
    ctx.beginPath();
    ctx.moveTo(7, 0);
    ctx.lineTo(-5, -4);
    ctx.lineTo(-5, 4);
    ctx.closePath();
    ctx.fill();
    ctx.restore();
    // Camera frame.
    ctx.strokeStyle = 'rgba(255,255,255,0.5)';
    ctx.strokeRect(
      x0 + s.camera.x * sx, y0 + s.camera.y * sy,
      view.w * sx, view.h * sy,
    );
  }

  function drawHud(s, view) {
    ctx.textAlign = 'left';
    // Wanted stars + cash, top left.
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(12, 12, 250, 62);
    ctx.font = 'bold 22px ' + FONT;
    for (let i = 0; i < 5; i += 1) {
      ctx.fillStyle = i < s.wanted ? PALETTE.star : 'rgba(255,255,255,0.25)';
      ctx.fillText('★', 22 + i * 26, 40);
    }
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px ' + FONT;
    ctx.fillText(`$${s.cash.toLocaleString('en-US')}`, 22, 66);
    // District + clock, top centre.
    const label = `${districtAt(s.player.x, s.player.y)}  •  ${String(Math.floor(s.clockMin / 60) % 24).padStart(2, '0')}:${String(Math.floor(s.clockMin % 60)).padStart(2, '0')}${s.rain > 0.3 ? '  •  RAIN' : ''}`;
    ctx.font = 'bold 17px ' + FONT;
    const tw = ctx.measureText(label).width;
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(view.w / 2 - tw / 2 - 14, 12, tw + 28, 34);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.fillText(label, view.w / 2, 36);
    ctx.textAlign = 'left';
    // HP / armor, top right (above the minimap).
    const bw = 190;
    const bx = view.w - bw - 14;
    const by = 12;
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(bx - 8, by - 2, bw + 16, 56);
    ctx.fillStyle = '#222';
    ctx.fillRect(bx, by + 6, bw, 12);
    ctx.fillStyle = PALETTE.hp;
    ctx.fillRect(bx, by + 6, bw * Math.max(0, s.player.hp / 100), 12);
    ctx.fillStyle = '#222';
    ctx.fillRect(bx, by + 26, bw, 12);
    ctx.fillStyle = PALETTE.armor;
    ctx.fillRect(bx, by + 26, bw * Math.max(0, s.player.armor / 100), 12);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 11px ' + FONT;
    ctx.fillText(`HP ${Math.round(s.player.hp)}`, bx, by + 16);
    ctx.fillText(`ARMOR ${Math.round(s.player.armor)}`, bx, by + 36);
    // Speed + car, bottom left.
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(12, view.h - 64, 240, 50);
    ctx.fillStyle = PALETTE.text;
    ctx.font = 'bold 20px ' + FONT;
    if (s.player.inCar && s.player.car) {
      const kmh = Math.round(Math.abs(s.player.car.speed) * 0.22);
      ctx.fillText(`${kmh} km/h`, 22, view.h - 36);
      ctx.font = '14px ' + FONT;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText(s.player.car.name, 22, view.h - 18);
    } else {
      ctx.fillText('On foot', 22, view.h - 36);
      ctx.font = '14px ' + FONT;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('E — steal a car', 22, view.h - 18);
    }
    // Mission tracker, bottom centre.
    const mission = s.missionIndex < 6 ? `MISSION ${s.missionIndex + 1}/6 — ${s.target.label}` : 'All missions complete';
    const dist = s.target ? Math.round(Math.hypot(s.target.x - s.player.x, s.target.y - s.player.y)) : 0;
    const track = `${mission}  •  ${dist}m`;
    ctx.font = 'bold 15px ' + FONT;
    const trw = ctx.measureText(track).width;
    ctx.fillStyle = PALETTE.hudBg;
    ctx.fillRect(view.w / 2 - trw / 2 - 12, view.h - 40, trw + 24, 28);
    ctx.fillStyle = PALETTE.accent;
    ctx.textAlign = 'center';
    ctx.fillText(track, view.w / 2, view.h - 21);
    ctx.textAlign = 'left';
    // Toast message.
    if (s.message) {
      ctx.font = 'bold 16px ' + FONT;
      const mw = ctx.measureText(s.message).width;
      ctx.fillStyle = 'rgba(10,12,18,0.85)';
      ctx.fillRect(view.w / 2 - mw / 2 - 12, 56, mw + 24, 30);
      ctx.fillStyle = '#fff';
      ctx.textAlign = 'center';
      ctx.fillText(s.message, view.w / 2, 77);
      ctx.textAlign = 'left';
    }
    drawMinimap(s, view, s.dialogue ? -196 : 0);
    // Dialogue panel.
    if (s.dialogue) {
      const line = s.dialogue.lines[s.dialogue.i];
      ctx.fillStyle = 'rgba(8,10,16,0.88)';
      ctx.fillRect(80, view.h - 190, view.w - 160, 104);
      ctx.strokeStyle = PALETTE.accent;
      ctx.lineWidth = 2;
      ctx.strokeRect(80, view.h - 190, view.w - 160, 104);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '16px ' + FONT;
      wrapText(line, 104, view.h - 158, view.w - 208, 22);
      ctx.fillStyle = PALETTE.muted;
      ctx.font = 'bold 13px ' + FONT;
      ctx.textAlign = 'right';
      ctx.fillText('ENTER ▸', view.w - 100, view.h - 100);
      ctx.textAlign = 'left';
    }
  }

  function wrapText(text, x, y, maxW, lineH) {
    const words = text.split(' ');
    let line = '';
    let yy = y;
    for (const word of words) {
      const test = line ? line + ' ' + word : word;
      if (ctx.measureText(test).width > maxW && line) {
        ctx.fillText(line, x, yy);
        line = word;
        yy += lineH;
      } else {
        line = test;
      }
    }
    ctx.fillText(line, x, yy);
  }

  function panel(title, lines, prompt, view) {
    ctx.fillStyle = 'rgba(8,10,16,0.82)';
    ctx.fillRect(0, 0, view.w, view.h);
    ctx.fillStyle = PALETTE.text;
    ctx.textAlign = 'center';
    ctx.font = 'bold 54px ' + FONT;
    ctx.fillText(title, view.w / 2, view.h / 2 - 70);
    ctx.font = '18px ' + FONT;
    let y = view.h / 2 - 10;
    for (const line of lines) {
      ctx.fillText(line, view.w / 2, y);
      y += 30;
    }
    ctx.fillStyle = PALETTE.accent;
    ctx.font = 'bold 18px ' + FONT;
    ctx.fillText(prompt, view.w / 2, y + 26);
    ctx.textAlign = 'left';
  }

  function draw(s, time, hasSave) {
    const view = resize();
    s.view.w = view.w;
    s.view.h = view.h;
    ctx.fillStyle = '#0b0e14';
    ctx.fillRect(0, 0, view.w, view.h);
    if (s.mode === 'title') {
      // A slow pan over Downtown behind the title.
      s.camera.x = clamp(1500 + Math.sin(time * 0.05) * 300, 0, WORLD.width - view.w);
      s.camera.y = clamp(1100 + Math.cos(time * 0.04) * 200, 0, WORLD.height - view.h);
      drawWorld(s, view, time);
      ctx.fillStyle = 'rgba(8,10,16,0.72)';
      ctx.fillRect(0, 0, view.w, view.h);
      ctx.textAlign = 'center';
      ctx.fillStyle = PALETTE.accent;
      ctx.font = 'bold 64px ' + FONT;
      ctx.fillText('HARBOR LIGHTS', view.w / 2, view.h / 2 - 90);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '22px ' + FONT;
      ctx.fillText('Solmar Bay belongs to whoever drives fastest.', view.w / 2, view.h / 2 - 48);
      ctx.font = '16px ' + FONT;
      ctx.fillStyle = PALETTE.muted;
      ctx.fillText('Mara Voss, getaway driver. Six jobs. One city. No mercy.', view.w / 2, view.h / 2 - 18);
      ctx.fillStyle = PALETTE.text;
      ctx.font = '16px ' + FONT;
      ctx.fillText('WASD / arrows — drive & walk    •    E — steal / exit car', view.w / 2, view.h / 2 + 30);
      ctx.fillText('Mouse — aim    •    Click — shoot    •    P — pause    •    M — mute    •    R — restart', view.w / 2, view.h / 2 + 58);
      ctx.fillStyle = PALETTE.accent;
      ctx.font = 'bold 20px ' + FONT;
      ctx.fillText(hasSave ? 'ENTER — continue your saved game' : 'ENTER — start a new game', view.w / 2, view.h / 2 + 108);
      ctx.textAlign = 'left';
      return;
    }
    drawWorld(s, view, time);
    if (s.mode === 'play' || s.mode === 'paused') drawHud(s, view);
    if (s.mode === 'paused') {
      panel('PAUSED', ['The city waits. Mara does not.', 'P — resume    •    R — restart'], 'P — keep driving', view);
    } else if (s.mode === 'dead') {
      panel('FLATLINED', ['Mara went down in Solmar Bay.', `Cash kept: $${s.cash.toLocaleString('en-US')}  •  Kills: ${s.kills}`], 'ENTER — get back up (-$100)', view);
    } else if (s.mode === 'busted') {
      panel('BUSTED', ['SBPD dragged Mara in. Rook posted bail.', `Cash kept: $${s.cash.toLocaleString('en-US')}  •  Kills: ${s.kills}`], 'ENTER — walk free (-$100)', view);
    } else if (s.mode === 'done') {
      panel('KING OF THE BAY', [
        'Dario is down. The yacht is yours. Solmar Bay answers to Mara Voss now.',
        `Final cash: $${s.cash.toLocaleString('en-US')}  •  Kills: ${s.kills}  •  Time: ${Math.floor(s.time / 60)}:${String(Math.floor(s.time % 60)).padStart(2, '0')}`,
      ], 'ENTER — play again', view);
    }
  }

  return { draw, resize };
}
