import { GoogleGenAI } from "@google/genai";

// Use the API key from Vite's define or environment
const GEMINI_API_KEY = "AIzaSyDi0yRgZGwwwhh5-R1Yv2Om9ViJGkhr6g8";

const video = document.getElementById('video') as HTMLVideoElement;
const captureTrigger = document.getElementById('capture-trigger') as HTMLButtonElement;
const uploadTrigger = document.getElementById('upload-trigger') as HTMLButtonElement;
const fileInput = document.getElementById('file-input') as HTMLInputElement;
const loader = document.getElementById('loader') as HTMLDivElement;
const resultDrawer = document.getElementById('result-drawer') as HTMLDivElement;
const resultText = document.getElementById('result-text') as HTMLDivElement;
const closeDrawerBtn = document.getElementById('close-drawer') as HTMLButtonElement;
const toast = document.getElementById('toast') as HTMLDivElement;
const apiStatus = document.getElementById('api-status') as HTMLSpanElement;
const totalCalDisplay = document.getElementById('total-cal-display') as HTMLDivElement;
const itemCount = document.getElementById('item-count') as HTMLDivElement;

// 初始化相機 (僅作為預覽背景)
async function initCamera() {
  try {
    const stream = await navigator.mediaDevices.getUserMedia({
      video: { facingMode: 'environment' },
      audio: false
    });
    video.srcObject = stream;
    const fallback = document.getElementById('camera-fallback');
    if (fallback) fallback.style.display = 'none';
    showToast('系統已就緒');
    apiStatus.innerText = '就緒';
  } catch (err) {
    console.warn('Camera preview error:', err);
    showToast('預覽不可用，請直接上傳照片');
    apiStatus.innerText = '就緒 (手動)';
    apiStatus.style.color = '#ffcc00';
  }
}

function showToast(msg: string) {
  toast.innerText = msg;
  toast.classList.add('show');
  setTimeout(() => toast.classList.remove('show'), 3000);
}

// 處理圖片分析
async function analyzeImage(base64Data: string) {
  if (!GEMINI_API_KEY) {
     const errorMsg = '錯誤：缺少 API 金鑰，請在設定中配置。';
     resultText.innerHTML = `<p style="color: #ef4444;">${errorMsg}</p>`;
     resultDrawer.classList.add('open');
     return;
  }

  const genAI = new GoogleGenAI(GEMINI_API_KEY);
  const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

  try {
    loader.classList.add('active');
    captureTrigger.disabled = true;
    apiStatus.innerText = '分析中...';

    const prompt = "請分析這張照片中的食物，回傳 JSON 格式：{\"foods\": [{\"name\":\"食物名稱\",\"calories\":數字,\"protein\":數字,\"carbs\":數字,\"fat\":數字}], \"total_calories\": 數字}。請確保回傳內容僅包含 JSON 字串，方便解析。使用繁體中文。";
    
    const result = await model.generateContent([
      prompt,
      { inlineData: { data: base64Data, mimeType: 'image/jpeg' } }
    ]);

    const response = await result.response;
    const rawText = response.text();
    
    // 嘗試解析 JSON
    let data;
    try {
      const jsonMatch = rawText.match(/\{[\s\S]*\}/);
      data = JSON.parse(jsonMatch ? jsonMatch[0] : rawText);
    } catch (e) {
      console.error('JSON 解析失敗', e, rawText);
      data = { foods: [], total_calories: 0, error: '無法解析內容，請再試一次。' };
    }

    renderResult(data);
    
  } catch (err: any) {
    console.error('Gemini error:', err);
    const errorHtml = `<p style="color: #ef4444;">分析錯誤: ${err.message}</p>`;
    resultText.innerHTML = errorHtml;
    resultDrawer.classList.add('open');
  } finally {
    loader.classList.remove('active');
    captureTrigger.disabled = false;
    apiStatus.innerText = '就緒';
  }
}

function renderResult(data: any) {
  if (data.error) {
    resultText.innerHTML = `<p>${data.error}</p>`;
    resultDrawer.classList.add('open');
    return;
  }

  totalCalDisplay.innerText = `${data.total_calories} kcal`;
  itemCount.innerText = data.foods.length.toString();
  apiStatus.innerText = '分析完成';

  let html = `<div class="food-card">
    <h2 style="color: var(--accent); margin-bottom: 20px; font-size: 28px; font-weight: 800;">${data.total_calories} <span style="font-size: 14px; font-weight: 400; color: var(--text-dim);">總大卡 (KCAL)</span></h2>
    <div>`;

  data.foods.forEach((food: any) => {
    html += `<div class="food-item">
      <div class="food-info">
        <span class="food-name">${food.name}</span>
        <span class="food-meta">蛋白質: ${food.protein}g · 碳水: ${food.carbs}g · 脂肪: ${food.fat}g</span>
      </div>
      <div class="food-cals">${food.calories} kcal</div>
    </div>`;
  });

  html += `</div></div>`;

  resultText.innerHTML = html;
  resultDrawer.classList.add('open');
}

// 事件監聽
captureTrigger.addEventListener('click', () => fileInput.click());
uploadTrigger.addEventListener('click', () => fileInput.click());
const historyBtn = document.getElementById('history-trigger');
if (historyBtn) {
  historyBtn.addEventListener('click', () => showToast('辨識紀錄功能開發中...'));
}

fileInput.addEventListener('change', (e: any) => {
  const file = e.target.files[0];
  if (!file) return;

  apiStatus.innerText = '讀取中...';
  
  const reader = new FileReader();
  reader.onload = (event: any) => {
    const base64 = event.target.result.split(',')[1];
    analyzeImage(base64);
  };
  reader.readAsDataURL(file);
});

closeDrawerBtn.addEventListener('click', () => {
  resultDrawer.classList.remove('open');
});

// 移除 Service Worker 以避免快取導致的畫面不更新
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.getRegistrations().then(registrations => {
    for (let registration of registrations) {
      registration.unregister();
    }
  });
}

initCamera();
