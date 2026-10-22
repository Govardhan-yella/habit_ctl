import { createModal, createToast } from './TerminalUI';

export function showCelebration(opts: { title: string; message: string; icon?: string; confetti?: boolean }) {
  const content = document.createElement('div');
  content.className = 'celebration';
  content.innerHTML = `
    <div class="celebration-icon">${opts.icon || '🎉'}</div>
    <div class="celebration-title">${opts.title}</div>
    <div class="celebration-message">${opts.message}</div>
  `;
  createModal('Achievement Unlocked', content, () => {});
  
  if (opts.confetti) {
    try {
      const canvas = document.createElement('canvas');
      canvas.className = 'confetti-canvas';
      document.body.appendChild(canvas);
      const ctx = canvas.getContext('2d')!;
      canvas.width = window.innerWidth;
      canvas.height = window.innerHeight;
      const pieces: Array<{x:number,y:number,r:number,d:number,c:string,vx:number,vy:number}> = [];
      const colors = ['#f7768e', '#9ece6a', '#7aa2f7', '#e0af68', '#bb9af7', '#7dcfff'];
      for (let i = 0; i < 120; i++) {
        pieces.push({
          x: Math.random()*canvas.width, y: Math.random()*canvas.height - canvas.height,
          r: Math.random()*6 + 4, d: Math.random()*120, c: colors[i%colors.length],
          vx: (Math.random()-0.5)*4, vy: Math.random()*3 + 2
        });
      }
      let t = 0;
      const anim = () => {
        ctx.clearRect(0,0,canvas.width,canvas.height);
        pieces.forEach(p => {
          p.y += p.vy; p.x += p.vx; p.d += 0.1;
          ctx.save(); ctx.translate(p.x,p.y); ctx.rotate(p.d*Math.PI/180);
          ctx.fillStyle = p.c; ctx.fillRect(-p.r/2,-p.r/2,p.r,p.r);
          ctx.restore();
        });
        t += 16;
        if (t < 2000) requestAnimationFrame(anim);
        else canvas.remove();
      };
      anim();
    } catch {}
  }
  setTimeout(() => createToast(opts.message, 'success'), 200);
}
