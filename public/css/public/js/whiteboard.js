class Whiteboard {
  constructor() {
    this.canvas = null;
    this.ctx = null;
    this.isDrawing = false;
    this.lastX = 0;
    this.lastY = 0;
    
    this.color = '#ffffff';
    this.brushSize = 5;
    this.isEraser = false;
    this.bgColor = '#181924';
    
    this.drawHistory = [];
  }

  init(canvasElement) {
    this.canvas = canvasElement;
    this.ctx = this.canvas.getContext('2d');
    
    this.setupListeners();
    this.resizeCanvas();
    window.addEventListener('resize', () => this.resizeCanvas());
  }

  setupListeners() {
    this.canvas.addEventListener('mousedown', (e) => this.startDrawing(e));
    this.canvas.addEventListener('mousemove', (e) => this.draw(e));
    this.canvas.addEventListener('mouseup', () => this.stopDrawing());
    this.canvas.addEventListener('mouseout', () => this.stopDrawing());

    this.canvas.addEventListener('touchstart', (e) => {
      e.preventDefault();
      this.startDrawing(e.touches[0]);
    }, { passive: false });

    this.canvas.addEventListener('touchmove', (e) => {
      e.preventDefault();
      this.draw(e.touches[0]);
    }, { passive: false });

    this.canvas.addEventListener('touchend', () => this.stopDrawing());

    const colors = document.querySelectorAll('.color-option');
    colors.forEach(col => {
      col.addEventListener('click', (e) => {
        colors.forEach(c => c.classList.remove('selected'));
        e.target.classList.add('selected');
        this.isEraser = false;
        document.getElementById('btn-eraser').classList.remove('active-teal');
        this.color = e.target.dataset.color;
      });
    });

    document.getElementById('brush-size').addEventListener('input', (e) => {
      this.brushSize = e.target.value;
    });

    const btnEraser = document.getElementById('btn-eraser');
    btnEraser.addEventListener('click', () => {
      this.isEraser = !this.isEraser;
      btnEraser.classList.toggle('active-teal', this.isEraser);
    });

    document.getElementById('btn-clear-canvas').addEventListener('click', () => {
      this.clear(true);
    });
  }

  resizeCanvas() {
    const rect = this.canvas.parentElement.getBoundingClientRect();
    this.canvas.width = rect.width || 800;
    this.canvas.height = rect.height || 500;
    this.redrawAll();
  }

  drawSegment(x0, y0, x1, y1, color, size, isEmit = false) {
    this.ctx.beginPath();
    this.ctx.moveTo(x0, y0);
    this.ctx.lineTo(x1, y1);
    this.ctx.strokeStyle = color;
    this.ctx.lineWidth = size;
    this.ctx.lineCap = 'round';
    this.ctx.lineJoin = 'round';
    this.ctx.stroke();

    const drawAction = { x0, y0, x1, y1, color, size };
    if (isEmit) {
      this.drawHistory.push(drawAction);
      window.webrtcManager.broadcastDrawAction(drawAction);
    }
  }

  renderRemoteDrawAction(action) {
    if (action.type === 'clear') {
      this.clear(false);
    } else {
      this.drawHistory.push(action);
      this.drawSegment(action.x0, action.y0, action.x1, action.y1, action.color, action.size, false);
    }
  }

  redrawAll() {
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    this.drawHistory.forEach(action => {
      this.drawSegment(action.x0, action.y0, action.x1, action.y1, action.color, action.size, false);
    });
  }

  startDrawing(e) {
    this.isDrawing = true;
    const coords = this.getRelativeCoordinates(e);
    this.lastX = coords.x;
    this.lastY = coords.y;
  }

  draw(e) {
    if (!this.isDrawing) return;
    const coords = this.getRelativeCoordinates(e);
    const currentX = coords.x;
    const currentY = coords.y;
    const currentColor = this.isEraser ? this.bgColor : this.color;
    
    this.drawSegment(this.lastX, this.lastY, currentX, currentY, currentColor, this.brushSize, true);
    this.lastX = currentX;
    this.lastY = currentY;
  }

  stopDrawing() {
    this.isDrawing = false;
  }

  clear(isEmit = false) {
    this.drawHistory = [];
    this.ctx.fillStyle = this.bgColor;
    this.ctx.fillRect(0, 0, this.canvas.width, this.canvas.height);
    if (isEmit) {
      window.webrtcManager.broadcastDrawAction({ type: 'clear' });
    }
  }

  getRelativeCoordinates(e) {
    const rect = this.canvas.getBoundingClientRect();
    const clientX = e.clientX !== undefined ? e.clientX : (e.touches ? e.touches[0].clientX : 0);
    const clientY = e.clientY !== undefined ? e.clientY : (e.touches ? e.touches[0].clientY : 0);
    return { x: clientX - rect.left, y: clientY - rect.top };
  }
}

window.whiteboard = new Whiteboard();
