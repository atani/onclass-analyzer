// オンクラス感想分析ダッシュボード - 分析エンジン

// 感情分析用キーワード辞書
const SENTIMENT_KEYWORDS = {
  positive: [
    'ありがとう', '良かった', 'よかった', '素晴らしい', 'すばらしい', '最高',
    '楽しい', 'たのしい', '嬉しい', 'うれしい', '感動', '感謝',
    'わかりやすい', '分かりやすい', '理解できた', '勉強になった', '参考になった',
    'できた', '出来た', 'できるようになった', '成長', '上達',
    '丁寧', 'ていねい', '親切', '優しい', 'やさしい',
    '面白い', 'おもしろい', '興味深い', '新しい発見', '気づき',
    '効果', '実感', '変化', '改善', 'スッキリ', 'すっきり'
  ],
  negative: [
    '難しい', 'むずかしい', 'わからない', '分からない', '理解できない',
    '苦手', '困った', '大変', 'できない', '出来ない',
    '遅い', '速い', '早い', 'ついていけない',
    '不安', '心配', '残念', '期待はずれ',
    '改善', '要望', 'もっと', 'してほしい', 'してほしかった',
    '動かない', '動けない', '思うように', 'うまくいかない', 'うまくできない',
    '上手くいかない', '上手くできない', '違う', '合わない', '足りない',
    '痛い', 'いたい', 'つらい', '辛い', 'きつい', 'しんどい'
  ]
};

// グローバル変数
let feedbackData = null;
let categoryChart = null;
let courseChart = null;
let timelineChart = null;
let currentCourseFilter = 'all'; // 'all', 'jfya', 'salon'
let userSortKey = 'count'; // ユーザーテーブルのソートキー
let blockSortKey = 'count'; // ブロックランキングのソートキー
let teacherSortKey = 'count'; // 先生ランキングのソートキー
let teacherPage = 0; // 先生ランキングの現在ページ
const teacherPageSize = 5; // 先生ランキングの1ページあたりの件数
let cachedUserStats = null; // ユーザー統計のキャッシュ
let cachedBlockStats = null; // ブロック統計のキャッシュ
let cachedTeacherStats = null; // 先生統計のキャッシュ
let cachedFeedbacks = null; // フィードバックのキャッシュ

// DOM要素
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const dashboard = document.getElementById('dashboard');
const resetBtn = document.getElementById('resetBtn');
const pdfBtn = document.getElementById('pdfBtn');
const actionButtons = document.getElementById('actionButtons');

// イベントリスナー設定
dropZone.addEventListener('click', () => fileInput.click());
dropZone.addEventListener('dragover', handleDragOver);
dropZone.addEventListener('dragleave', handleDragLeave);
dropZone.addEventListener('drop', handleDrop);
fileInput.addEventListener('change', handleFileSelect);
resetBtn.addEventListener('click', resetDashboard);
pdfBtn.addEventListener('click', exportToPDF);

// コースフィルターボタン
document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    btn.classList.add('active');
    currentCourseFilter = btn.dataset.course;
    if (feedbackData) {
      analyzeAndRender();
    }
  });
});

function handleDragOver(e) {
  e.preventDefault();
  dropZone.classList.add('drag-over');
}

function handleDragLeave(e) {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
}

function handleDrop(e) {
  e.preventDefault();
  dropZone.classList.remove('drag-over');
  const file = e.dataTransfer.files[0];
  if (file) processFile(file);
}

function handleFileSelect(e) {
  const file = e.target.files[0];
  if (file) processFile(file);
}

function processFile(file) {
  if (!file.name.endsWith('.json')) {
    alert('JSONファイルを選択してください');
    return;
  }

  const reader = new FileReader();
  reader.onload = (e) => {
    try {
      const data = JSON.parse(e.target.result);
      if (!data.feedbacks || !Array.isArray(data.feedbacks)) {
        throw new Error('Invalid format');
      }
      feedbackData = data;
      analyzeAndRender();
    } catch (err) {
      alert('ファイルの読み込みに失敗しました。正しいJSONファイルか確認してください。');
      console.error(err);
    }
  };
  reader.readAsText(file);
}

function resetDashboard() {
  dashboard.classList.remove('visible');
  dropZone.style.display = 'block';
  actionButtons.classList.remove('visible');
  fileInput.value = '';
  feedbackData = null;
  currentCourseFilter = 'all';
  // フィルターボタンをリセット
  document.querySelectorAll('.filter-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.course === 'all');
  });
}

// PDF出力
async function exportToPDF() {
  const btn = pdfBtn;
  const originalText = btn.textContent;
  btn.textContent = '生成中...';
  btn.disabled = true;

  try {
    const { jsPDF } = window.jspdf;

    // ダッシュボード全体をキャプチャ
    const element = document.querySelector('.container');

    // 一時的にスタイルを調整
    const originalBg = document.body.style.background;
    document.body.style.background = 'white';

    const canvas = await html2canvas(element, {
      scale: 2,
      useCORS: true,
      logging: false,
      backgroundColor: '#ffffff'
    });

    document.body.style.background = originalBg;

    // PDF生成
    const imgData = canvas.toDataURL('image/png');
    const imgWidth = 210; // A4 width in mm
    const pageHeight = 297; // A4 height in mm
    const imgHeight = (canvas.height * imgWidth) / canvas.width;

    const pdf = new jsPDF('p', 'mm', 'a4');

    let heightLeft = imgHeight;
    let position = 0;

    // 最初のページ
    pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
    heightLeft -= pageHeight;

    // 複数ページ対応
    while (heightLeft > 0) {
      position = heightLeft - imgHeight;
      pdf.addPage();
      pdf.addImage(imgData, 'PNG', 0, position, imgWidth, imgHeight);
      heightLeft -= pageHeight;
    }

    // ファイル名に日付とフィルターを含める
    const date = new Date().toISOString().split('T')[0];
    const filterSuffix = currentCourseFilter === 'all' ? '' : `-${currentCourseFilter}`;
    pdf.save(`onclass-analysis${filterSuffix}-${date}.pdf`);

  } catch (error) {
    console.error('PDF export error:', error);
    alert('PDF生成に失敗しました。ブラウザの印刷機能をお試しください（Cmd+P / Ctrl+P）');
  } finally {
    btn.textContent = originalText;
    btn.disabled = false;
  }
}

// コースフィルター関数
function filterFeedbacksByCourse(feedbacks, filter) {
  return feedbacks.filter(f => {
    const course = f.course || '';
    const courseLower = course.toLowerCase();

    // テスト用は常に除外
    if (course.includes('テスト用')) return false;

    if (filter === 'all') return true;

    switch (filter) {
      case 'jfya':
        return courseLower.includes('jfya');
      case 'salon':
        return course.includes('オンラインサロン');
      case 'sc':
        return course.includes('SC養成講座');
      case 'fc':
        return course.includes('FC養成講座');
      case 'pre':
        return course.includes('PRE養成講座');
      default:
        return true;
    }
  });
}

// フィルターラベル取得
function getFilterLabel(filter) {
  switch (filter) {
    case 'jfya': return 'JFYA';
    case 'salon': return 'オンラインサロン';
    case 'sc': return '【13期】SC養成講座';
    case 'fc': return '【13期】FC養成講座';
    case 'pre': return '【13期】PRE養成講座';
    default: return 'すべてのコース';
  }
}

// メイン分析・描画関数
function analyzeAndRender() {
  dropZone.style.display = 'none';
  dashboard.classList.add('visible');
  actionButtons.classList.add('visible');

  // フィルター適用
  const allFeedbacks = feedbackData.feedbacks;
  const feedbacks = filterFeedbacksByCourse(allFeedbacks, currentCourseFilter);

  // フィルターラベル更新
  const filterLabel = document.getElementById('currentFilterLabel');
  const totalCount = allFeedbacks.length;
  const filteredCount = feedbacks.length;
  if (currentCourseFilter === 'all') {
    filterLabel.textContent = `全${totalCount}件を表示中`;
  } else {
    filterLabel.textContent = `${getFilterLabel(currentCourseFilter)}: ${filteredCount}件 / 全${totalCount}件`;
  }

  // 基本統計
  renderBasicStats(feedbacks);

  // 感情分析
  renderSentimentAnalysis(feedbacks);

  // 改善要望サマリー
  renderImprovementSummary(feedbacks);

  // 先生別ランキング
  renderTeacherRanking(feedbacks);

  // 人気ランキング
  renderBlockRanking(feedbacks);

  // カテゴリー別チャート
  renderCategoryChart(feedbacks);

  // コース別チャート
  renderCourseChart(feedbacks);

  // 時系列チャート
  renderTimelineChart(feedbacks);

  // キーワード分析
  renderKeywordCloud(feedbacks);

  // ユーザー分析
  renderUserAnalysis(feedbacks);

  // 継続率分析
  renderEngagementAnalysis(feedbacks);
}

// 基本統計
function renderBasicStats(feedbacks) {
  document.getElementById('totalFeedbacks').textContent = feedbacks.length.toLocaleString();

  // 日付範囲
  const dates = feedbacks.filter(f => f.date).map(f => f.date).sort();
  if (dates.length > 0) {
    document.getElementById('dateRange').textContent = `${dates[0]} 〜 ${dates[dates.length - 1]}`;
  }

  // ユニークユーザー
  const uniqueUsers = new Set(feedbacks.map(f => f.userName).filter(n => n && n !== '不明'));
  document.getElementById('uniqueUsers').textContent = uniqueUsers.size.toLocaleString();

  // 平均感想長
  const avgLength = Math.round(
    feedbacks.reduce((sum, f) => sum + (f.content?.length || 0), 0) / feedbacks.length
  );
  document.getElementById('avgLength').textContent = avgLength.toLocaleString();
}

// 感情分析
function renderSentimentAnalysis(feedbacks) {
  let positive = 0, negative = 0, neutral = 0;

  feedbacks.forEach(f => {
    const content = f.content || '';
    const sentiment = analyzeSentiment(content);
    if (sentiment > 0) positive++;
    else if (sentiment < 0) negative++;
    else neutral++;
  });

  const total = feedbacks.length;
  const posPercent = Math.round((positive / total) * 100);
  const negPercent = Math.round((negative / total) * 100);
  const neuPercent = 100 - posPercent - negPercent;

  // バー更新
  const bar = document.getElementById('sentimentBar');
  bar.innerHTML = `
    <div class="sentiment-positive" style="width: ${posPercent}%"></div>
    <div class="sentiment-neutral" style="width: ${neuPercent}%"></div>
    <div class="sentiment-negative" style="width: ${negPercent}%"></div>
  `;

  document.getElementById('positiveCount').textContent = `${positive}件 (${posPercent}%)`;
  document.getElementById('neutralCount').textContent = `${neutral}件 (${neuPercent}%)`;
  document.getElementById('negativeCount').textContent = `${negative}件 (${negPercent}%)`;

  // スコア
  const score = posPercent - negPercent;
  document.getElementById('sentimentScore').textContent = score > 0 ? `+${score}` : score;
  document.getElementById('sentimentFormula').textContent = `${posPercent}% − ${negPercent}% = ${score > 0 ? '+' + score : score}`;

  // インサイト
  const insightBox = document.getElementById('sentimentInsight');
  if (posPercent >= 70) {
    insightBox.innerHTML = `
      <div class="insight-title">💡 素晴らしい満足度！</div>
      <div class="insight-text">
        ${posPercent}%がポジティブな感想です。現在の講座内容は受講生に好評です。
        特に「わかりやすさ」「効果実感」に関する声が多いか確認してみましょう。
      </div>
    `;
  } else if (negPercent >= 30) {
    insightBox.className = 'insight-box warning';
    insightBox.innerHTML = `
      <div class="insight-title">⚠️ 改善の余地あり</div>
      <div class="insight-text">
        ${negPercent}%に改善要望が見られます。「難しい」「ついていけない」などの声がないか確認し、
        難易度調整やフォローアップを検討しましょう。
      </div>
    `;
  } else {
    insightBox.innerHTML = `
      <div class="insight-title">💡 安定した評価</div>
      <div class="insight-text">
        概ね良好な評価です。さらに満足度を高めるため、
        ニュートラル層(${neuPercent}%)の声を詳しく分析し、期待を超えるコンテンツを目指しましょう。
      </div>
    `;
  }
}

function analyzeSentiment(text) {
  let score = 0;
  SENTIMENT_KEYWORDS.positive.forEach(keyword => {
    if (text.includes(keyword)) score++;
  });
  SENTIMENT_KEYWORDS.negative.forEach(keyword => {
    if (text.includes(keyword)) score--;
  });
  return score;
}

// 改善要望サマリー
function renderImprovementSummary(feedbacks) {
  // 改善要望（ネガティブスコア）のフィードバックを抽出
  const negativeFeedbacks = feedbacks.filter(f => {
    const content = f.content || '';
    return analyzeSentiment(content) < 0;
  });

  if (negativeFeedbacks.length === 0) {
    document.getElementById('improvementSection').style.display = 'none';
    return;
  }

  // セクションを表示
  document.getElementById('improvementSection').style.display = 'block';

  // 講座カテゴリー別に集計
  const categoryStats = {};
  negativeFeedbacks.forEach(f => {
    const category = f.category || '不明';
    if (!categoryStats[category]) {
      categoryStats[category] = { count: 0, feedbacks: [] };
    }
    categoryStats[category].count++;
    categoryStats[category].feedbacks.push(f);
  });

  // カテゴリーを件数順にソート
  const sortedCategories = Object.entries(categoryStats)
    .filter(([name]) => name !== '不明')
    .sort((a, b) => b[1].count - a[1].count);

  // キーワード頻度を集計
  const keywordCounts = {};
  SENTIMENT_KEYWORDS.negative.forEach(kw => {
    negativeFeedbacks.forEach(f => {
      if ((f.content || '').includes(kw)) {
        keywordCounts[kw] = (keywordCounts[kw] || 0) + 1;
      }
    });
  });

  const sortedKeywords = Object.entries(keywordCounts)
    .filter(([, count]) => count >= 1)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 10);

  // キーワード表示
  const keywordsEl = document.getElementById('improvementKeywords');
  keywordsEl.innerHTML = `
    <div style="margin-bottom: 8px; color: #64748b; font-size: 13px;">頻出キーワード（クリックで詳細表示）:</div>
    ${sortedKeywords.map(([kw, count]) =>
      `<span class="improvement-keyword" data-keyword="${escapeHtml(kw)}">${escapeHtml(kw)} (${count})</span>`
    ).join('')}
  `;

  // キーワードクリックイベントを設定
  keywordsEl.querySelectorAll('.improvement-keyword').forEach(tag => {
    tag.addEventListener('click', () => {
      const keyword = tag.dataset.keyword;
      const wasSelected = tag.classList.contains('selected');
      keywordsEl.querySelectorAll('.improvement-keyword').forEach(t => t.classList.remove('selected'));

      if (wasSelected) {
        hideImprovementFeedbacks();
      } else {
        tag.classList.add('selected');
        showImprovementFeedbacksForKeyword(keyword, negativeFeedbacks);
      }
    });
  });

  // 閉じるボタンイベント
  document.getElementById('improvementFeedbacksClose').onclick = () => {
    hideImprovementFeedbacks();
    keywordsEl.querySelectorAll('.improvement-keyword').forEach(t => t.classList.remove('selected'));
  };

  // カテゴリー別サマリー表示
  const samplesEl = document.getElementById('improvementSamples');
  let samplesHtml = `
    <div style="margin-bottom: 12px; color: #64748b; font-size: 13px;">
      改善要望が多いカテゴリー（講座分野）:
    </div>
  `;

  sortedCategories.slice(0, 5).forEach(([category, data]) => {
    // このカテゴリー内でどんなキーワードが多いか
    const categoryKeywords = {};
    SENTIMENT_KEYWORDS.negative.forEach(kw => {
      data.feedbacks.forEach(f => {
        if ((f.content || '').includes(kw)) {
          categoryKeywords[kw] = (categoryKeywords[kw] || 0) + 1;
        }
      });
    });
    const topKeywords = Object.entries(categoryKeywords)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([kw]) => kw);

    samplesHtml += `
      <div class="improvement-category">
        <div class="improvement-category-title">
          ${escapeHtml(category)}
          <span class="improvement-category-count">${data.count}件</span>
        </div>
        ${topKeywords.length > 0 ? `
          <div style="margin-bottom: 8px; font-size: 12px; color: #94a3b8;">
            主な声: ${topKeywords.map(kw => `「${kw}」`).join(' ')}
          </div>
        ` : ''}
    `;

    // サンプルコメント（最大2件）
    const samples = data.feedbacks.slice(0, 2);
    samples.forEach(f => {
      const content = (f.content || '').slice(0, 120) + ((f.content || '').length > 120 ? '...' : '');
      samplesHtml += `
        <div class="improvement-sample">
          ${escapeHtml(content)}
          <div class="improvement-sample-meta">
            ${f.userName ? escapeHtml(f.userName) : ''}${f.block ? ' / ' + escapeHtml(f.block) : ''}${f.date ? ' / ' + f.date : ''}
          </div>
        </div>
      `;
    });

    samplesHtml += '</div>';
  });

  // 全体サマリー
  samplesHtml += `
    <div class="insight-box warning" style="margin-top: 16px;">
      <div class="insight-title">📊 改善要望の傾向</div>
      <div class="insight-text">
        全${negativeFeedbacks.length}件の改善要望のうち、
        ${sortedCategories.length > 0 ? `「${sortedCategories[0][0]}」が${sortedCategories[0][1].count}件で最多です。` : ''}
        ${sortedKeywords.length > 0 ? `「${sortedKeywords[0][0]}」という声が${sortedKeywords[0][1]}件見られます。` : ''}
      </div>
    </div>
  `;

  samplesEl.innerHTML = samplesHtml;
}

// ブロック名から先生名を抽出
function extractTeacherName(block) {
  if (!block) return null;
  // パターン: 「○○先生」を抽出（【】内や：の前など様々なパターンに対応）
  const match = block.match(/([^\s【】：:]+先生)/);
  if (match) return match[1];
  return null;
}

// 先生別ランキング
function renderTeacherRanking(feedbacks) {
  // 先生を集計
  const teachers = {};
  feedbacks.forEach(f => {
    const teacherName = extractTeacherName(f.block);
    if (!teacherName) return;
    if ((f.course || '').includes('テスト用')) return;

    if (!teachers[teacherName]) {
      teachers[teacherName] = { count: 0, positive: 0, negative: 0 };
    }
    teachers[teacherName].count++;

    const sentiment = analyzeSentiment(f.content || '');
    if (sentiment > 0) teachers[teacherName].positive++;
    else if (sentiment < 0) teachers[teacherName].negative++;
  });

  cachedTeacherStats = teachers;

  // ソートボタンのイベント設定
  document.querySelectorAll('#teacherSortButtons .sort-btn').forEach(btn => {
    btn.onclick = () => {
      teacherSortKey = btn.dataset.sort;
      teacherPage = 0; // ソート変更時はページをリセット
      updateTeacherSortButtons();
      renderTeacherList();
    };
  });

  // ページングボタンのイベント設定
  document.getElementById('teacherPrevBtn').onclick = () => {
    if (teacherPage > 0) {
      teacherPage--;
      renderTeacherList();
    }
  };
  document.getElementById('teacherNextBtn').onclick = () => {
    const totalPages = Math.ceil(Object.keys(cachedTeacherStats).length / teacherPageSize);
    if (teacherPage < totalPages - 1) {
      teacherPage++;
      renderTeacherList();
    }
  };

  teacherPage = 0; // 初期化時はページをリセット
  renderTeacherList();

  // 閉じるボタンイベント
  document.getElementById('teacherFeedbacksClose').onclick = () => {
    hideTeacherFeedbacks();
    document.querySelectorAll('#teacherRankingList .ranking-item').forEach(i => i.classList.remove('selected'));
  };
}

// ソートボタンを更新
function updateTeacherSortButtons() {
  document.querySelectorAll('#teacherSortButtons .sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === teacherSortKey);
  });
}

// 先生リストを描画
function renderTeacherList() {
  updateTeacherSortButtons();

  const allSorted = Object.entries(cachedTeacherStats)
    .sort((a, b) => b[1][teacherSortKey] - a[1][teacherSortKey]);

  const totalPages = Math.ceil(allSorted.length / teacherPageSize);
  const start = teacherPage * teacherPageSize;
  const sorted = allSorted.slice(start, start + teacherPageSize);

  // ページ情報を更新
  document.getElementById('teacherPageInfo').textContent = `${teacherPage + 1} / ${totalPages}`;
  document.getElementById('teacherPrevBtn').disabled = teacherPage === 0;
  document.getElementById('teacherNextBtn').disabled = teacherPage >= totalPages - 1;

  const list = document.getElementById('teacherRankingList');
  list.innerHTML = sorted.length === 0
    ? '<li class="ranking-item" style="color: #94a3b8;">データがありません</li>'
    : sorted.map(([name, stats], i) => {
        const rank = start + i + 1;
        return `
        <li class="ranking-item clickable" data-teacher="${escapeHtml(name)}">
          <div class="ranking-rank ${rank <= 3 ? `top-${rank}` : ''}">${rank}</div>
          <div class="ranking-name">${escapeHtml(name)}</div>
          <div class="ranking-sentiment">
            <span style="color: #10b981; font-weight: 600;" title="ポジティブ">✓${stats.positive}</span>
            <span style="color: #dc2626; font-weight: 600; margin-left: 8px;" title="改善要望">⚠${stats.negative}</span>
          </div>
          <div class="ranking-count">${stats.count}件</div>
        </li>
      `;
      }).join('');

  // クリックイベントを設定
  list.querySelectorAll('.ranking-item.clickable').forEach(item => {
    item.addEventListener('click', () => {
      const teacherName = item.dataset.teacher;
      const wasSelected = item.classList.contains('selected');

      // 既存の展開を削除
      list.querySelectorAll('.ranking-feedback-row').forEach(r => r.remove());
      list.querySelectorAll('.ranking-item').forEach(i => i.classList.remove('selected'));

      if (!wasSelected) {
        item.classList.add('selected');
        showTeacherFeedbacksInline(teacherName, item);
      }
    });
  });
}

// 先生の感想をインライン表示
function showTeacherFeedbacksInline(teacherName, item) {
  const matchingFeedbacks = cachedFeedbacks.filter(f => extractTeacherName(f.block) === teacherName);

  const feedbackHtml = matchingFeedbacks.slice(0, 20).map(f => {
    const sentimentClass = getSentimentClass(f.content || '');
    const sentimentLabel = getSentimentLabel(f.content || '');
    return `
      <div class="teacher-feedback-item ${sentimentClass}">
        ${sentimentLabel}
        <div>${escapeHtml(f.content || '')}</div>
        <div class="keyword-feedback-meta">
          ${f.userName ? `<span>👤 ${escapeHtml(f.userName)}</span>` : ''}
          ${f.block ? `<span>📚 ${escapeHtml(f.block)}</span>` : ''}
          ${f.date ? `<span>📅 ${f.date}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const moreText = matchingFeedbacks.length > 20
    ? `<div style="text-align: center; color: #94a3b8; padding: 12px; font-size: 13px;">他 ${matchingFeedbacks.length - 20}件</div>`
    : '';

  const newRow = document.createElement('li');
  newRow.className = 'ranking-feedback-row';
  newRow.innerHTML = `
    <div class="ranking-feedbacks-inline">
      <div class="ranking-feedbacks-inline-header">
        <span class="ranking-feedbacks-title">${escapeHtml(teacherName)}の感想 (${matchingFeedbacks.length}件)</span>
        <button class="ranking-feedbacks-close" onclick="this.closest('.ranking-feedback-row').remove(); document.querySelector('#teacherRankingList .ranking-item.selected')?.classList.remove('selected');">✕ 閉じる</button>
      </div>
      <div class="ranking-feedbacks-inline-list">
        ${feedbackHtml}
        ${moreText}
      </div>
    </div>
  `;

  item.after(newRow);
}

// ブロックランキング
function renderBlockRanking(feedbacks) {
  // タイトル更新
  const title = currentCourseFilter === 'all'
    ? '🏆 人気ブロック'
    : `🏆 人気ブロック【${getFilterLabel(currentCourseFilter)}】`;
  document.getElementById('blockRankingTitle').textContent = title;

  // ブロックを集計してキャッシュ
  const blocks = {};
  feedbacks.forEach(f => {
    const block = f.block || '不明';
    if (block === '不明') return;
    if ((f.course || '').includes('テスト用')) return;

    if (!blocks[block]) {
      blocks[block] = { count: 0, positive: 0, negative: 0 };
    }
    blocks[block].count++;

    const sentiment = analyzeSentiment(f.content || '');
    if (sentiment > 0) blocks[block].positive++;
    else if (sentiment < 0) blocks[block].negative++;
  });

  cachedBlockStats = blocks;

  // ソートボタンのイベント設定
  document.querySelectorAll('#blockSortButtons .sort-btn').forEach(btn => {
    btn.onclick = () => {
      blockSortKey = btn.dataset.sort;
      updateBlockSortButtons();
      renderBlockList(feedbacks);
    };
  });

  renderBlockList(feedbacks);

  // 閉じるボタンイベント
  document.getElementById('blockFeedbacksClose').onclick = () => {
    hideBlockFeedbacks();
    document.querySelectorAll('#blockRankingList .ranking-item').forEach(i => i.classList.remove('selected'));
  };
}

// ソートボタンを更新
function updateBlockSortButtons() {
  document.querySelectorAll('#blockSortButtons .sort-btn').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.sort === blockSortKey);
  });
}

// ブロックリストを描画
function renderBlockList(feedbacks) {
  updateBlockSortButtons();

  const sorted = Object.entries(cachedBlockStats)
    .sort((a, b) => b[1][blockSortKey] - a[1][blockSortKey])
    .slice(0, 10);

  const list = document.getElementById('blockRankingList');
  list.innerHTML = sorted.length === 0
    ? '<li class="ranking-item" style="color: #94a3b8;">データがありません</li>'
    : sorted.map(([name, stats], i) => `
        <li class="ranking-item clickable" data-block="${escapeHtml(name)}">
          <div class="ranking-rank ${i < 3 ? `top-${i + 1}` : ''}">${i + 1}</div>
          <div class="ranking-name">${escapeHtml(name)}</div>
          <div class="ranking-sentiment">
            <span style="color: #10b981; font-weight: 600;" title="ポジティブ">✓${stats.positive}</span>
            <span style="color: #dc2626; font-weight: 600; margin-left: 8px;" title="改善要望">⚠${stats.negative}</span>
          </div>
          <div class="ranking-count">${stats.count}件</div>
        </li>
      `).join('');

  // ブロッククリックイベントを設定
  list.querySelectorAll('.ranking-item.clickable').forEach(item => {
    item.addEventListener('click', () => {
      const blockName = item.dataset.block;
      const wasSelected = item.classList.contains('selected');

      // 既存の展開を削除
      list.querySelectorAll('.ranking-feedback-row').forEach(r => r.remove());
      list.querySelectorAll('.ranking-item').forEach(i => i.classList.remove('selected'));

      if (!wasSelected) {
        item.classList.add('selected');
        showBlockFeedbacksInline(blockName, item, feedbacks);
      }
    });
  });
}

// ブロックの感想をインライン表示
function showBlockFeedbacksInline(blockName, item, feedbacks) {
  const matchingFeedbacks = feedbacks.filter(f => f.block === blockName);

  const feedbackHtml = matchingFeedbacks.slice(0, 20).map(f => {
    const sentimentClass = getSentimentClass(f.content || '');
    const sentimentLabel = getSentimentLabel(f.content || '');
    return `
      <div class="block-feedback-item ${sentimentClass}">
        ${sentimentLabel}
        <div>${escapeHtml(f.content || '')}</div>
        <div class="keyword-feedback-meta">
          ${f.userName ? `<span>👤 ${escapeHtml(f.userName)}</span>` : ''}
          ${f.category ? `<span>📂 ${escapeHtml(f.category)}</span>` : ''}
          ${f.date ? `<span>📅 ${f.date}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const moreText = matchingFeedbacks.length > 20
    ? `<div style="text-align: center; color: #94a3b8; padding: 12px; font-size: 13px;">他 ${matchingFeedbacks.length - 20}件</div>`
    : '';

  const newRow = document.createElement('li');
  newRow.className = 'ranking-feedback-row';
  newRow.innerHTML = `
    <div class="ranking-feedbacks-inline">
      <div class="ranking-feedbacks-inline-header">
        <span class="ranking-feedbacks-title">「${escapeHtml(blockName)}」の感想 (${matchingFeedbacks.length}件)</span>
        <button class="ranking-feedbacks-close" onclick="this.closest('.ranking-feedback-row').remove(); document.querySelector('#blockRankingList .ranking-item.selected')?.classList.remove('selected');">✕ 閉じる</button>
      </div>
      <div class="ranking-feedbacks-inline-list">
        ${feedbackHtml}
        ${moreText}
      </div>
    </div>
  `;

  item.after(newRow);
}

// カテゴリー別チャート
function renderCategoryChart(feedbacks) {
  const categoryCounts = {};
  feedbacks.forEach(f => {
    const category = f.category || '不明';
    categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  });

  const sorted = Object.entries(categoryCounts)
    .filter(([name]) => name !== '不明')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const ctx = document.getElementById('categoryChart').getContext('2d');

  if (categoryChart) categoryChart.destroy();

  categoryChart = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: sorted.map(([name]) => truncate(name, 15)),
      datasets: [{
        label: '感想数',
        data: sorted.map(([, count]) => count),
        backgroundColor: '#4F46E5',
        borderRadius: 4
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// コース別チャート
function renderCourseChart(feedbacks) {
  const courseCounts = {};
  feedbacks.forEach(f => {
    let courseName = f.course || '不明';
    // コース名を簡略化（長すぎる場合）
    if (courseName.length > 20) {
      courseName = courseName.slice(0, 20) + '...';
    }
    courseCounts[courseName] = (courseCounts[courseName] || 0) + 1;
  });

  const sorted = Object.entries(courseCounts)
    .filter(([name]) => name !== '不明')
    .sort((a, b) => b[1] - a[1])
    .slice(0, 8);

  const ctx = document.getElementById('courseChart').getContext('2d');

  if (courseChart) courseChart.destroy();

  // 色のパレット
  const colors = [
    '#4F46E5', '#7C3AED', '#EC4899', '#F59E0B',
    '#10B981', '#06B6D4', '#8B5CF6', '#EF4444'
  ];

  courseChart = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: sorted.map(([name]) => name),
      datasets: [{
        data: sorted.map(([, count]) => count),
        backgroundColor: colors.slice(0, sorted.length),
        borderWidth: 2,
        borderColor: '#ffffff'
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: {
          position: 'right',
          labels: {
            boxWidth: 12,
            padding: 8,
            font: { size: 11 }
          }
        }
      }
    }
  });
}

// 時系列チャート
function renderTimelineChart(feedbacks) {
  const dateCounts = {};
  feedbacks.forEach(f => {
    if (f.date) {
      dateCounts[f.date] = (dateCounts[f.date] || 0) + 1;
    }
  });

  const sorted = Object.entries(dateCounts).sort((a, b) => a[0].localeCompare(b[0]));

  const ctx = document.getElementById('timelineChart').getContext('2d');

  if (timelineChart) timelineChart.destroy();

  timelineChart = new Chart(ctx, {
    type: 'line',
    data: {
      labels: sorted.map(([date]) => date),
      datasets: [{
        label: '感想数',
        data: sorted.map(([, count]) => count),
        borderColor: '#4F46E5',
        backgroundColor: 'rgba(79, 70, 229, 0.1)',
        fill: true,
        tension: 0.3
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false }
      },
      scales: {
        y: { beginAtZero: true }
      }
    }
  });
}

// キーワード分析
function renderKeywordCloud(feedbacks) {
  const wordCounts = {};

  // 大幅に拡充したストップワード（述語・助詞・一般的な言葉を除外）
  const stopWords = new Set([
    // 助詞
    'の', 'に', 'は', 'を', 'が', 'と', 'で', 'て', 'た', 'し', 'も', 'な', 'い', 'へ', 'や', 'か', 'ね', 'よ', 'わ',
    // 助動詞・語尾
    'です', 'ます', 'ました', 'でした', 'ません', 'ない', 'なかった', 'たい', 'たかった', 'だった', 'である',
    // 動詞（一般的なもの）
    'する', 'した', 'して', 'します', 'される', 'させる', 'できる', 'できた', 'できない', 'なる', 'なった', 'なって',
    'ある', 'あった', 'あり', 'あります', 'いる', 'いた', 'いて', 'います', 'おる', 'くる', 'きた', 'きて',
    'いく', 'いった', 'やる', 'やった', 'やって', 'もらう', 'もらった', 'くれる', 'くれた', 'あげる', 'あげた',
    'みる', 'みた', 'みて', 'おく', 'おいた', 'しまう', 'しまった',
    // 思考・感情の一般動詞
    '思う', '思った', '思います', '思いました', '思って', '感じる', '感じた', '感じました', '考える', '考えた',
    // 形容詞（一般的なもの）
    'いい', 'よい', 'よかった', 'ない', 'なかった', 'ほしい', 'ほしかった',
    // 副詞・接続詞
    'こと', 'もの', 'ところ', 'とき', 'ため', 'よう', 'ほう', 'かた', 'など', 'くらい', 'ぐらい',
    'まだ', 'もう', 'まず', 'また', 'さらに', 'そして', 'しかし', 'でも', 'ただ', 'けど', 'けれど',
    'とても', 'すごく', 'かなり', 'ちょっと', '少し', 'もっと', 'やはり', 'やっぱり', 'たぶん', 'きっと',
    // 指示語
    'この', 'その', 'あの', 'どの', 'これ', 'それ', 'あれ', 'どれ', 'ここ', 'そこ', 'あそこ', 'どこ',
    'こう', 'そう', 'ああ', 'どう', 'こんな', 'そんな', 'あんな', 'どんな',
    // 人称・一般名詞
    '自分', '私', 'わたし', '僕', 'ぼく', '方', 'かた', '人', 'ひと', '皆', 'みんな', '先生', 'せんせい',
    '今日', 'きょう', '今回', '毎回', '毎日', '最初', '最後', '次', 'つぎ', '前', 'まえ', '後', 'あと',
    // 一般的すぎる言葉
    '本当', 'ほんとう', '大変', 'たいへん', '普通', 'ふつう', '結構', 'けっこう', '大丈夫', 'だいじょうぶ',
    '一番', 'いちばん', '特に', 'とくに', '全然', 'ぜんぜん', '全部', 'ぜんぶ', '色々', 'いろいろ',
    // 敬語・丁寧語
    'ございます', 'いただき', 'いただきました', 'くださり', 'くださいました', 'おります',
    // その他の一般語
    '気持ち', 'きもち', '部分', 'ぶぶん', '感じ', 'かんじ', '意味', 'いみ', '理由', 'りゆう',
    '内容', 'ないよう', '説明', 'せつめい', '質問', 'しつもん', '回答', 'かいとう',
    'レッスン', 'れっすん', '動画', 'どうが', 'コース', 'こーす',
    // 挨拶・定型文
    '今年も', '今年もよろしく', 'よろしくお願い', 'お願いしま', 'お願いします', 'お願いいたしま',
    '明けまして', 'おめでとう', 'ありがとうございま', 'ありがとうござい',
    '引き続き', '今後とも', '今後も', '継続して', '続けて',
    '配信ありがとう', '配信あり', 'アップありがとう'
  ]);

  // 末尾パターン（活用語尾）を除外するための正規表現
  const verbEndingPatterns = [
    /^.+(ました|ません|ています|ていた|ている|てない|ていない)$/,
    /^.+(られる|られた|られて|させる|させた|させて)$/,
    /^.+(しまう|しまった|しまって|ておく|ておいた)$/,
    /^.+(できる|できた|できて|できない|できなかった)$/,
    /^.+(なければ|なきゃ|ないと|なくて|なかった)$/,
    /^.+(かった|くない|くなる|くなった)$/, // 形容詞活用
  ];

  feedbacks.forEach(f => {
    const content = f.content || '';

    // カタカナ語（3文字以上）を抽出
    const katakanaWords = content.match(/[\u30a0-\u30ff]{3,}/g) || [];

    // 漢字を含む単語（2-12文字）を抽出
    const kanjiWords = content.match(/[\u4e00-\u9faf][\u4e00-\u9faf\u3040-\u309f]{1,11}/g) || [];

    const allWords = [...katakanaWords, ...kanjiWords];

    allWords.forEach(word => {
      // ストップワードチェック
      if (stopWords.has(word)) return;

      // 活用語尾パターンチェック
      if (verbEndingPatterns.some(pattern => pattern.test(word))) return;

      // 2文字のひらがなのみは除外
      if (/^[\u3040-\u309f]{2}$/.test(word)) return;

      // カウント
      wordCounts[word] = (wordCounts[word] || 0) + 1;
    });
  });

  const sorted = Object.entries(wordCounts)
    .filter(([word, count]) => count >= 2) // 2回以上出現したものだけ
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25);

  const maxCount = sorted[0]?.[1] || 1;

  const cloud = document.getElementById('keywordCloud');

  if (sorted.length === 0) {
    cloud.innerHTML = '<span style="color: #94a3b8;">キーワードが抽出できませんでした</span>';
    return;
  }

  cloud.innerHTML = sorted.map(([word, count]) => {
    const ratio = count / maxCount;
    let sizeClass = '';
    if (ratio > 0.7) sizeClass = 'large';
    else if (ratio > 0.4) sizeClass = 'medium';
    return `<span class="keyword-tag clickable ${sizeClass}" data-keyword="${escapeHtml(word)}">${escapeHtml(word)} (${count})</span>`;
  }).join('');

  // キーワードクリックイベントを設定
  cloud.querySelectorAll('.keyword-tag.clickable').forEach(tag => {
    tag.addEventListener('click', () => {
      const keyword = tag.dataset.keyword;
      // 選択状態を切り替え
      const wasSelected = tag.classList.contains('selected');
      cloud.querySelectorAll('.keyword-tag').forEach(t => t.classList.remove('selected'));

      if (wasSelected) {
        // 閉じる
        hideKeywordFeedbacks();
      } else {
        tag.classList.add('selected');
        showFeedbacksForKeyword(keyword, feedbacks);
      }
    });
  });

  // 閉じるボタンイベント
  const closeBtn = document.getElementById('keywordFeedbacksClose');
  closeBtn.onclick = () => {
    hideKeywordFeedbacks();
    cloud.querySelectorAll('.keyword-tag').forEach(t => t.classList.remove('selected'));
  };
}

// キーワードを含む感想を表示
function showFeedbacksForKeyword(keyword, feedbacks) {
  const container = document.getElementById('keywordFeedbacks');
  const title = document.getElementById('keywordFeedbacksTitle');
  const list = document.getElementById('keywordFeedbacksList');

  // キーワードを含む感想をフィルタリング
  const matchingFeedbacks = feedbacks.filter(f => {
    const content = f.content || '';
    return content.includes(keyword);
  });

  title.textContent = `「${keyword}」を含む感想 (${matchingFeedbacks.length}件)`;

  // 感想リストを生成
  list.innerHTML = matchingFeedbacks.slice(0, 20).map(f => {
    // キーワードをハイライト
    const content = (f.content || '').replace(
      new RegExp(`(${escapeRegExp(keyword)})`, 'g'),
      '<span class="highlight">$1</span>'
    );
    const sentimentClass = getSentimentClass(f.content || '');
    const sentimentLabel = getSentimentLabel(f.content || '');
    return `
      <div class="keyword-feedback-item ${sentimentClass}">
        ${sentimentLabel}
        <div>${content}</div>
        <div class="keyword-feedback-meta">
          ${f.userName ? `<span>👤 ${escapeHtml(f.userName)}</span>` : ''}
          ${f.block ? `<span>📚 ${escapeHtml(f.block)}</span>` : ''}
          ${f.date ? `<span>📅 ${f.date}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (matchingFeedbacks.length > 20) {
    list.innerHTML += `<div style="text-align: center; color: #94a3b8; padding: 12px; font-size: 13px;">他 ${matchingFeedbacks.length - 20}件</div>`;
  }

  container.style.display = 'block';
}

// 感想リストを非表示
function hideKeywordFeedbacks() {
  document.getElementById('keywordFeedbacks').style.display = 'none';
}

// 正規表現用エスケープ
function escapeRegExp(string) {
  return string.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

// 改善要望キーワードを含む感想を表示
function showImprovementFeedbacksForKeyword(keyword, feedbacks) {
  const container = document.getElementById('improvementFeedbacks');
  const title = document.getElementById('improvementFeedbacksTitle');
  const list = document.getElementById('improvementFeedbacksList');

  const matchingFeedbacks = feedbacks.filter(f => {
    const content = f.content || '';
    return content.includes(keyword);
  });

  title.textContent = `「${keyword}」を含む改善要望 (${matchingFeedbacks.length}件)`;

  list.innerHTML = matchingFeedbacks.slice(0, 20).map(f => {
    const content = (f.content || '').replace(
      new RegExp(`(${escapeRegExp(keyword)})`, 'g'),
      '<span class="highlight">$1</span>'
    );
    return `
      <div class="improvement-feedback-item">
        <div>${content}</div>
        <div class="keyword-feedback-meta">
          ${f.userName ? `<span>👤 ${escapeHtml(f.userName)}</span>` : ''}
          ${f.block ? `<span>📚 ${escapeHtml(f.block)}</span>` : ''}
          ${f.date ? `<span>📅 ${f.date}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (matchingFeedbacks.length > 20) {
    list.innerHTML += `<div style="text-align: center; color: #94a3b8; padding: 12px; font-size: 13px;">他 ${matchingFeedbacks.length - 20}件</div>`;
  }

  container.style.display = 'block';
}

// 改善要望感想リストを非表示
function hideImprovementFeedbacks() {
  document.getElementById('improvementFeedbacks').style.display = 'none';
}

// 感情に基づくCSSクラスを取得
function getSentimentClass(content) {
  const score = analyzeSentiment(content);
  if (score > 0) return 'feedback-positive';
  if (score < 0) return 'feedback-negative';
  return 'feedback-neutral';
}

// 感情ラベルを生成
function getSentimentLabel(content) {
  const score = analyzeSentiment(content);
  if (score < 0) return '<span class="feedback-label negative">⚠ 改善要望</span>';
  if (score > 0) return '<span class="feedback-label positive">✓ ポジティブ</span>';
  return '';
}

// ブロックの感想を表示
function showFeedbacksForBlock(blockName, feedbacks) {
  const container = document.getElementById('blockFeedbacks');
  const title = document.getElementById('blockFeedbacksTitle');
  const list = document.getElementById('blockFeedbacksList');

  const matchingFeedbacks = feedbacks.filter(f => f.block === blockName);

  title.textContent = `「${blockName}」の感想 (${matchingFeedbacks.length}件)`;

  list.innerHTML = matchingFeedbacks.slice(0, 20).map(f => {
    const sentimentClass = getSentimentClass(f.content || '');
    const sentimentLabel = getSentimentLabel(f.content || '');
    return `
      <div class="block-feedback-item ${sentimentClass}">
        ${sentimentLabel}
        <div>${escapeHtml(f.content || '')}</div>
        <div class="keyword-feedback-meta">
          ${f.userName ? `<span>👤 ${escapeHtml(f.userName)}</span>` : ''}
          ${f.category ? `<span>📂 ${escapeHtml(f.category)}</span>` : ''}
          ${f.date ? `<span>📅 ${f.date}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (matchingFeedbacks.length > 20) {
    list.innerHTML += `<div style="text-align: center; color: #94a3b8; padding: 12px; font-size: 13px;">他 ${matchingFeedbacks.length - 20}件</div>`;
  }

  container.style.display = 'block';
}

// ブロック感想リストを非表示
function hideBlockFeedbacks() {
  document.getElementById('blockFeedbacks').style.display = 'none';
}

// ユーザーの感想を表示
function showFeedbacksForUser(userName, feedbacks) {
  const container = document.getElementById('userFeedbacks');
  const title = document.getElementById('userFeedbacksTitle');
  const list = document.getElementById('userFeedbacksList');

  const matchingFeedbacks = feedbacks.filter(f => f.userName === userName);

  title.textContent = `${userName} さんの感想 (${matchingFeedbacks.length}件)`;

  list.innerHTML = matchingFeedbacks.slice(0, 30).map(f => {
    const sentimentClass = getSentimentClass(f.content || '');
    const sentimentLabel = getSentimentLabel(f.content || '');
    return `
      <div class="user-feedback-item ${sentimentClass}">
        ${sentimentLabel}
        <div>${escapeHtml(f.content || '')}</div>
        <div class="keyword-feedback-meta">
          ${f.block ? `<span>📚 ${escapeHtml(f.block)}</span>` : ''}
          ${f.category ? `<span>📂 ${escapeHtml(f.category)}</span>` : ''}
          ${f.date ? `<span>📅 ${f.date}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (matchingFeedbacks.length > 30) {
    list.innerHTML += `<div style="text-align: center; color: #94a3b8; padding: 12px; font-size: 13px;">他 ${matchingFeedbacks.length - 30}件</div>`;
  }

  container.style.display = 'block';
}

// ユーザー感想リストを非表示
function hideUserFeedbacks() {
  document.getElementById('userFeedbacks').style.display = 'none';
}

// ユーザー分析
function renderUserAnalysis(feedbacks) {
  // 統計を計算してキャッシュ
  const userStats = {};
  feedbacks.forEach(f => {
    const user = f.userName || '不明';
    if (user === '不明') return;

    if (!userStats[user]) {
      userStats[user] = { count: 0, positive: 0, negative: 0, categories: new Set() };
    }
    userStats[user].count++;

    const sentiment = analyzeSentiment(f.content || '');
    if (sentiment > 0) userStats[user].positive++;
    else if (sentiment < 0) userStats[user].negative++;

    if (f.category) userStats[user].categories.add(f.category);
  });

  cachedUserStats = userStats;
  cachedFeedbacks = feedbacks;

  // ソートヘッダーのイベント設定
  document.querySelectorAll('#userTable th.sortable').forEach(th => {
    th.onclick = () => {
      const sortKey = th.dataset.sort;
      userSortKey = sortKey;
      updateUserTableSort();
      renderUserTable();
    };
  });

  renderUserTable();

  // 閉じるボタンイベント
  document.getElementById('userFeedbacksClose').onclick = () => {
    hideUserFeedbacks();
    document.querySelectorAll('#userTable tbody tr').forEach(r => r.classList.remove('selected'));
  };

  // ユーザー検索機能を設定
  setupUserSearch();
}

// ユーザー検索機能
function setupUserSearch() {
  const input = document.getElementById('userSearchInput');
  const results = document.getElementById('userSearchResults');

  input.value = '';
  results.classList.remove('visible');

  // クリック時に全ユーザー表示
  input.addEventListener('focus', () => {
    showUserList('');
  });

  input.addEventListener('input', () => {
    showUserList(input.value.trim().toLowerCase());
  });

  function showUserList(query) {
    const allUsers = Object.entries(cachedUserStats)
      .sort((a, b) => b[1].count - a[1].count);

    const matches = query.length < 1
      ? allUsers
      : allUsers.filter(([name]) => name.toLowerCase().includes(query));

    if (matches.length === 0) {
      results.innerHTML = '<div class="user-search-item" style="color: #94a3b8;">該当するユーザーがいません</div>';
    } else {
      results.innerHTML = `
        <div style="padding: 8px 14px; background: #f8fafc; border-bottom: 1px solid #e2e8f0; font-size: 12px; color: #64748b; position: sticky; top: 0;">
          ${matches.length}人のユーザー（感想数順）
        </div>
      ` + matches.map(([name, stats]) => `
        <div class="user-search-item" data-user="${escapeHtml(name)}">
          <span class="user-search-item-name">${escapeHtml(name)}</span>
          <span class="user-search-item-stats">
            ${stats.count}件
            <span style="color: #10b981;">✓${stats.positive}</span>
            <span style="color: #dc2626;">⚠${stats.negative}</span>
          </span>
        </div>
      `).join('');

      results.querySelectorAll('.user-search-item[data-user]').forEach(item => {
        item.addEventListener('click', () => {
          const userName = item.dataset.user;
          results.classList.remove('visible');
          input.value = userName;
          showSearchedUserFeedbacks(userName);
        });
      });
    }

    results.classList.add('visible');
  }

  // 検索欄の外をクリックで閉じる
  document.addEventListener('click', (e) => {
    if (!e.target.closest('.user-search-box')) {
      results.classList.remove('visible');
    }
  });
}

// 検索結果からユーザーの感想を表示
function showSearchedUserFeedbacks(userName) {
  const tbody = document.querySelector('#userTable tbody');

  // 既存の展開行と選択を削除
  tbody.querySelectorAll('tr.user-feedback-row').forEach(r => r.remove());
  tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));

  // 検索結果用の感想表示エリア
  const container = document.getElementById('userFeedbacks');
  const title = document.getElementById('userFeedbacksTitle');
  const list = document.getElementById('userFeedbacksList');

  const matchingFeedbacks = cachedFeedbacks.filter(f => f.userName === userName);

  title.textContent = `${userName} さんの感想 (${matchingFeedbacks.length}件)`;

  list.innerHTML = matchingFeedbacks.slice(0, 30).map(f => {
    const sentimentClass = getSentimentClass(f.content || '');
    const sentimentLabel = getSentimentLabel(f.content || '');
    return `
      <div class="user-feedback-item ${sentimentClass}">
        ${sentimentLabel}
        <div>${escapeHtml(f.content || '')}</div>
        <div class="keyword-feedback-meta">
          ${f.block ? `<span>📚 ${escapeHtml(f.block)}</span>` : ''}
          ${f.category ? `<span>📂 ${escapeHtml(f.category)}</span>` : ''}
          ${f.date ? `<span>📅 ${f.date}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  if (matchingFeedbacks.length > 30) {
    list.innerHTML += `<div style="text-align: center; color: #94a3b8; padding: 12px; font-size: 13px;">他 ${matchingFeedbacks.length - 30}件</div>`;
  }

  container.style.display = 'block';
}

// ソートアイコンを更新
function updateUserTableSort() {
  document.querySelectorAll('#userTable th.sortable').forEach(th => {
    const isActive = th.dataset.sort === userSortKey;
    th.classList.toggle('active', isActive);
    th.querySelector('.sort-icon').textContent = isActive ? '↓' : '';
  });
}

// ユーザーテーブルを描画
function renderUserTable() {
  updateUserTableSort();

  const sorted = Object.entries(cachedUserStats)
    .sort((a, b) => b[1][userSortKey] - a[1][userSortKey])
    .slice(0, 15);

  const tbody = document.querySelector('#userTable tbody');
  tbody.innerHTML = sorted.map(([name, stats]) => `
    <tr data-user="${escapeHtml(name)}">
      <td>${escapeHtml(name)}</td>
      <td><strong>${stats.count}</strong>件</td>
      <td><span style="color: #10b981; font-weight: 600;">${stats.positive}</span></td>
      <td><span style="color: #dc2626; font-weight: 600;">${stats.negative}</span></td>
      <td>${stats.categories.size}カテゴリー</td>
    </tr>
  `).join('');

  // ユーザークリックイベントを設定
  tbody.querySelectorAll('tr[data-user]').forEach(row => {
    row.addEventListener('click', () => {
      const userName = row.dataset.user;
      const wasSelected = row.classList.contains('selected');

      // 既存の展開行と選択を削除
      tbody.querySelectorAll('tr.user-feedback-row').forEach(r => r.remove());
      tbody.querySelectorAll('tr').forEach(r => r.classList.remove('selected'));

      if (!wasSelected) {
        row.classList.add('selected');
        showUserFeedbacksInline(userName, row);
      }
    });
  });
}

// ユーザーの感想を行の下にインライン表示
function showUserFeedbacksInline(userName, row) {
  const matchingFeedbacks = cachedFeedbacks.filter(f => f.userName === userName);

  const feedbackHtml = matchingFeedbacks.slice(0, 20).map(f => {
    const sentimentClass = getSentimentClass(f.content || '');
    const sentimentLabel = getSentimentLabel(f.content || '');
    return `
      <div class="user-feedback-item ${sentimentClass}">
        ${sentimentLabel}
        <div>${escapeHtml(f.content || '')}</div>
        <div class="keyword-feedback-meta">
          ${f.block ? `<span>📚 ${escapeHtml(f.block)}</span>` : ''}
          ${f.category ? `<span>📂 ${escapeHtml(f.category)}</span>` : ''}
          ${f.date ? `<span>📅 ${f.date}</span>` : ''}
        </div>
      </div>
    `;
  }).join('');

  const moreText = matchingFeedbacks.length > 20
    ? `<div style="text-align: center; color: #94a3b8; padding: 12px; font-size: 13px;">他 ${matchingFeedbacks.length - 20}件</div>`
    : '';

  const newRow = document.createElement('tr');
  newRow.className = 'user-feedback-row';
  newRow.innerHTML = `
    <td colspan="5" style="padding: 0; background: #f8fafc;">
      <div class="user-feedbacks-inline">
        <div class="user-feedbacks-inline-header">
          <span class="user-feedbacks-title">${escapeHtml(userName)} さんの感想 (${matchingFeedbacks.length}件)</span>
          <button class="user-feedbacks-close" onclick="this.closest('tr').remove(); document.querySelector('#userTable tbody tr.selected')?.classList.remove('selected');">✕ 閉じる</button>
        </div>
        <div class="user-feedbacks-inline-list">
          ${feedbackHtml}
          ${moreText}
        </div>
      </div>
    </td>
  `;

  row.after(newRow);
}

// 継続率・エンゲージメント分析
function renderEngagementAnalysis(feedbacks) {
  const userStats = {};

  feedbacks.forEach(f => {
    const user = f.userName || '不明';
    if (user === '不明') return;

    if (!userStats[user]) {
      userStats[user] = { count: 0, categories: new Set() };
    }
    userStats[user].count++;
    if (f.category) userStats[user].categories.add(f.category);
  });

  const users = Object.values(userStats);
  const totalUsers = users.length;

  if (totalUsers === 0) {
    document.getElementById('repeaterRate').textContent = '-';
    document.getElementById('heavyUsers').textContent = '-';
    document.getElementById('avgCategories').textContent = '-';
    return;
  }

  // リピーター率（2回以上）
  const repeaters = users.filter(u => u.count >= 2).length;
  const repeaterRate = Math.round((repeaters / totalUsers) * 100);
  document.getElementById('repeaterRate').textContent = `${repeaterRate}%`;

  // ヘビーユーザー（5回以上）
  const heavyUsers = users.filter(u => u.count >= 5).length;
  document.getElementById('heavyUsers').textContent = `${heavyUsers}人`;

  // 平均参加カテゴリー
  const avgCategories = (users.reduce((sum, u) => sum + u.categories.size, 0) / totalUsers).toFixed(1);
  document.getElementById('avgCategories').textContent = avgCategories;

  // インサイト
  const insightBox = document.getElementById('engagementInsight');
  let insights = [];

  if (repeaterRate < 30) {
    insights.push('リピーター率が低めです。初回参加者へのフォローアップを強化しましょう。');
  } else if (repeaterRate >= 50) {
    insights.push('リピーター率が高く、継続して学ぶ人が多いです。');
  }

  if (heavyUsers > 0) {
    insights.push(`${heavyUsers}人のヘビーユーザーがいます。コミュニティのコアメンバーとして活用できます。`);
  }

  if (parseFloat(avgCategories) >= 2) {
    insights.push('複数カテゴリーに参加する人が多く、講座の幅広さが活かされています。');
  } else {
    insights.push('1つのカテゴリーに留まる傾向があります。他講座の紹介を強化しましょう。');
  }

  insightBox.innerHTML = `
    <div class="insight-title">💡 継続率向上のヒント</div>
    <div class="insight-text">${insights.join('<br>')}</div>
  `;
}

// ユーティリティ関数
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function truncate(str, len) {
  return str.length > len ? str.slice(0, len) + '...' : str;
}
