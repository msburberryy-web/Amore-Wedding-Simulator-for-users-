
import React, { useState, useEffect, useRef } from 'react';
import { QuoteItem, AmoreService, VenueInfo, MochikomiItem, QuoteCategory, VenueSuggestion } from './types';
import { fetchMinimumFee } from './services/geminiService';
import { MENU_CATALOG, CatalogItem, VENUE_LIST } from './services/simulatorData';
import { ServiceCard } from './components/ServiceCard';
import { Heart, Loader2, Sparkles, X, Info, Plus, Minus, Download, PieChart as PieChartIcon, ChevronRight, Settings, FileText, LayoutGrid, Users, Landmark, BookOpen, CheckCircle2, Wallet, TrendingUp, TrendingDown, ArrowRight, Image as ImageIcon, HelpCircle, Award, Star, Check, MousePointer2, ListChecks, MessageCircle, MapPin, Search, Clock } from 'lucide-react';
import html2canvas from 'html2canvas';

// --- 品目マスタ reference prices from spreadsheet ---
const HINMOKU_MASTER_PRICES: Record<string, number> = {
  '1': 120000,
  '2': 120000,
  'amore_main_fl': 70000,
  'makeup': 35000,
  'webinv': 10000,
  'transport': 15000,
};

// Maps English quote item names → Japanese template names
const TEMPLATE_ITEM_NAMES: Record<string, string> = {
  'Venue Service Package (Per Person)': 'プラン（ウェディングケーキ、フリードリンク含む）',
  'Venue Rental & Service fees': '会場使用料',
  'Chapel Usage fees': '挙式料（チャペル）',
  'Venue Food Menu (Buffet/Course)': 'お料理（コース）',
  'Drinks (Free Drink Plan)': 'お飲み物（フリードリンク）',
  'Groom: Handling Fee (Western)': '新郎洋装持込料',
  'Bride: Handling Fee (Western)': '新婦洋装持込料',
};

// Maps Amore service IDs → Japanese template names
const AMORE_TEMPLATE_NAMES: Record<string, string> = {
  '1': 'プロジュース・プランナー, MC',
  '2': 'スチール撮影＋ビデオ撮影（スタンダード）',
  'dress': 'ドレス・タキシードレンタル',
  'makeup': 'ヘアメイク（新婦）',
  'amore_bouquet': '生花ブーケ',
  'amore_main_fl': 'メインテーブル装花・写真ブース',
  'amore_guest_fl': 'ゲストテーブル装花',
  'webinv': 'Web招待状・シーティングチャート',
  'transport': '交通費',
};

// --- VENUE & AMORE CONFIG ---
type FoodPlanType = 'course' | 'tableshare' | 'buffet';
const FOOD_PLANS: Record<FoodPlanType, { ja: string; en: string; minPrice: number; maxPrice: number; defaultPrice: number }> = {
  course:     { ja: 'コース料理',   en: 'Course Menu',  minPrice: 11000, maxPrice: 19000, defaultPrice: 13000 },
  tableshare: { ja: 'テーブルシェア', en: 'Table Share',  minPrice: 9000,  maxPrice: 15000, defaultPrice: 11000 },
  buffet:     { ja: 'ビュッフェ',   en: 'Buffet',       minPrice: 7000,  maxPrice: 12000, defaultPrice: 9000  },
};
// Mandatory venue items — always included, user adjusts price only
const VENUE_MANDATORY_ITEMS = [
  { id: 'mand_venue',  ja: '会場使用料',                  en: 'Venue Rental Fee',          minPrice:  50000, maxPrice: 200000, defaultPrice: 100000, unit: '式' },
  { id: 'mand_bridal', ja: 'ブライズ利用料',              en: 'Bridal Room Usage',         minPrice:  20000, maxPrice:  50000, defaultPrice:  30000, unit: '式' },
  { id: 'mand_sound',  ja: '音響・照明（オペレーター込み）', en: 'Sound & Lighting (w/ Op.)', minPrice:  50000, maxPrice: 120000, defaultPrice:  60000, unit: '式' },
  { id: 'mand_staff',  ja: 'スタッフなど',                en: 'Staff Services',            minPrice:  20000, maxPrice:  80000, defaultPrice:  30000, unit: '式' },
];
const VENUE_OPTIONAL_ITEMS = [
  { id: 'opt_attend',    ja: '介添え',              en: 'Wedding Attendant',     minPrice: 20000, maxPrice:  40000, defaultPrice: 25000, isPerGuest: false, unit: '式' },
  { id: 'opt_favor',    ja: '引出物（スタンダード）', en: 'Wedding Favors',        minPrice:  2000, maxPrice:   5000, defaultPrice:  3000, isPerGuest: true,  unit: '個' },
  { id: 'opt_gift',     ja: 'プチギフト',            en: 'Mini Gift',             minPrice:   500, maxPrice:   1000, defaultPrice:   700, isPerGuest: true,  unit: '人' },
  { id: 'opt_champagne',ja: 'シャンパンタワー',       en: 'Champagne Tower',       minPrice: 30000, maxPrice:  80000, defaultPrice: 50000, isPerGuest: false, unit: '式' },
  { id: 'opt_cake',     ja: 'ウェディングケーキ',     en: 'Wedding Cake',          minPrice: 30000, maxPrice:  80000, defaultPrice: 50000, isPerGuest: false, unit: '式' },
  { id: 'opt_lobby',    ja: 'ロビー演出',            en: 'Lobby Decoration',      minPrice: 20000, maxPrice:  50000, defaultPrice: 30000, isPerGuest: false, unit: '式' },
  { id: 'opt_extend',   ja: '延長料金',              en: 'Time Extension Fee',    minPrice: 20000, maxPrice:  50000, defaultPrice: 30000, isPerGuest: false, unit: '時間' },
  { id: 'opt_carpet',   ja: 'レッドカーペット',       en: 'Red Carpet',            minPrice: 10000, maxPrice:  30000, defaultPrice: 15000, isPerGuest: false, unit: '式' },
  { id: 'opt_preptime', ja: '準備時間の追加',         en: 'Additional Prep Time',  minPrice: 10000, maxPrice:  30000, defaultPrice: 15000, isPerGuest: false, unit: '時間' },
];
const AMORE_STANDARD_PRETAX = 370000;
const AMORE_STANDARD_INCLUDES = [
  { ja: 'MC & プランニング', price: 120000 },
  { ja: '写真 + ビデオ',    price: 120000 },
  { ja: 'メインテーブル装花', price: 70000 },
  { ja: 'ヘアメイク',        price: 35000 },
  { ja: 'Web招待状',        price: 10000 },
  { ja: '交通費',           price: 15000 },
];
const AMORE_ADDON_CONFIG = {
  dressSecond:         30000,
  sulyarYitPat:        15000,
  realBouquet:         { min: 20000, max: 50000 },
  guestFlowerPerTable: 3500,
  placingCardPerPerson:250,
  photoUpgrade:        { min: 30000, max: 50000 },
  aisleFlower:         { min: 20000, max: 50000 },
};

// --- TYPES ---
type TabType = 'setup' | 'catalog' | 'amore' | 'preview';
type Language = 'en' | 'ja' | 'my';

// --- TRANSLATIONS ---
const TRANSLATIONS = {
  en: {
    title: "Wedding Budget Simulation",
    subtitle: "Initial cost simulation · For planning purposes only",
    appIntro: "Use this simulator to explore how different venue and service choices affect your total budget. All figures shown are reference ranges — your Amore planner will confirm actual costs once venue and services are finalised.",
    guestCount: "Guest Count",
    date: "Date",
    totalEstimate: "Simulated Total",
    subtotalVenue: "Venue Subtotal",
    subtotalAmore: "Amore Services",
    subtotal: "Subtotal",
    tax: "Consumption Tax (10%)",
    totalRange: "Simulated Range",
    disclaimer: "This is a budget simulation for internal planning use — not a final quotation or binding price. Figures are reference estimates only. Final costs will be confirmed by your Amore planner.",
    budgetFriendlyNote: "Budget friendly option? Please freely discuss with us. We are happy to tailor the plan to your needs.",
    menuBook: "Venue Selection",
    menuBookDesc: "How would you like to calculate venue costs?",
    calcModeDetailed: "Pick Detailed Items",
    calcModeDetailedDesc: "Select rental, food, and drinks separately.",
    calcModePerPerson: "Simple Per-Person Rate",
    calcModePerPersonDesc: "Use a flat-rate venue package fee.",
    targetBudget: "Target Budget",
    budgetStatus: "Budget Usage",
    remaining: "Remaining",
    overBudget: "Over Budget",
    budgetSummary: "Budget Planning",
    step1: "Budget",
    step2: "Venue",
    step3: "Amore",
    step4: "Final",
    guide: "Guide",
    whySelect: "Why select this?",
    qualityVolume: "Quality & Volume",
    addToEstimate: "Add to Estimate",
    removeFromEstimate: "Remove",
    included: "Included in Estimate",
    notIncluded: "Not Selected",
    nextStepAmore: "Next: Amore Services",
    generateSummary: "View Simulation Summary",
    viewDocument: "View Simulation",
    estimateTotal: "Simulated Total (Inc. Tax)",
    quantity: "Quantity",
    table: "Table",
    perPerson: "per person",
    recommendedVenues: "Sample venues",
    recommendedVenuesDesc: "Matching your selection (Up to ¥",
    venuePackageNote: "Note: These package prices may already include services like floral decor, dress, hair/makeup, etc., in addition to food and beverage. Please check their official websites for exact details.",
    selectVenue: "Select this Venue",
    selected: "Selected",
    serviceDetails: "Service Details",
    generatedOn: "Generated on",
    amoreTokyo: "Amore Wedding Tokyo",
    categories: {
      [QuoteCategory.VENUE_FEE]: 'Venue & Facilities',
      [QuoteCategory.FOOD_DRINK]: 'Food & Beverage',
      [QuoteCategory.ATTIRE_BEAUTY]: 'Attire & Beauty',
      [QuoteCategory.FLORAL_DECOR]: 'Floral & Decoration',
      [QuoteCategory.PHOTO_VIDEO]: 'Photography & Videography',
      [QuoteCategory.ENTERTAINMENT]: 'Entertainment & Sound',
      [QuoteCategory.OTHER]: 'Other Services',
    }
  },
  ja: {
    title: "ブライダル費用シミュレーション",
    subtitle: "初期費用試算 · プランニング参考資料",
    appIntro: "このシミュレーターでは、会場やサービスの選択が総費用にどう影響するかをご確認いただけます。表示価格はあくまでも参考目安です。正式な費用はAmoreプランナーと各会場で確認の上ご案内いたします。",
    guestCount: "招待客数",
    date: "作成日",
    totalEstimate: "シミュレーション合計",
    subtotalVenue: "会場関係費（参考）",
    subtotalAmore: "Amoreサービス料（参考）",
    subtotal: "小計",
    tax: "消費税 (10%)",
    totalRange: "シミュレーション合計（目安）",
    buffer: "(予備費 +5%)",
    disclaimer: "本資料はプランニング用の費用シミュレーションであり、正式な見積書・契約書ではありません。表示金額はすべて参考目安です。正式費用はAmoreプランナーより別途ご案内いたします。",
    budgetFriendlyNote: "ご予算に応じたプランのご提案も可能です。お気軽にご相談ください。",
    menuBook: "会場費用の選択",
    menuBookDesc: "会場費用の算出方法をお選びください。",
    calcModeDetailed: "項目ごとに選ぶ",
    calcModeDetailedDesc: "挙式、料理、飲物を個別に選択します。",
    calcModePerPerson: "1名あたりの一律料金",
    calcModePerPersonDesc: "会場パッケージ料金で算出します。",
    targetBudget: "目標予算",
    budgetStatus: "予算使用率",
    remaining: "残予算",
    overBudget: "予算超過",
    budgetSummary: "予算計画",
    step1: "予算",
    step2: "会場",
    step3: "Amore",
    step4: "概要",
    guide: "解説",
    whySelect: "なぜこれが必要？",
    qualityVolume: "品質・ボリューム",
    addToEstimate: "見積に追加",
    removeFromEstimate: "削除",
    included: "見積に含まれています",
    notIncluded: "未選択",
    nextStepAmore: "次へ: Amoreサービス",
    generateSummary: "シミュレーション結果へ",
    viewDocument: "シミュレーション表示",
    estimateTotal: "シミュレーション合計（税込）",
    quantity: "数量",
    table: "卓",
    perPerson: "1名あたり",
    recommendedVenues: "会場のサンプル",
    recommendedVenuesDesc: "選択範囲内の会場 (最大 ¥",
    venuePackageNote: "注意：これらのパッケージ価格には、料理や飲料に加えて、装花、衣装、ヘアメイクなどのサービスが含まれている場合があります。詳細は各会場の公式サイトをご確認ください。",
    selectVenue: "この会場を選択",
    selected: "選択済み",
    serviceDetails: "サービス詳細",
    generatedOn: "作成日時",
    amoreTokyo: "Amore Wedding Tokyo",
    categories: {
      [QuoteCategory.VENUE_FEE]: '会場費・設備',
      [QuoteCategory.FOOD_DRINK]: '料理・飲料',
      [QuoteCategory.ATTIRE_BEAUTY]: '衣装・美容',
      [QuoteCategory.FLORAL_DECOR]: '装花・装飾',
      [QuoteCategory.PHOTO_VIDEO]: '写真・映像',
      [QuoteCategory.ENTERTAINMENT]: '演出・音響',
      [QuoteCategory.OTHER]: 'その他サービス',
    }
  },
  my: {
    title: "မင်္ဂလာဆောင် ဘတ်ဂျက် စီမံချက်",
    subtitle: "ကနဦးကုန်ကျစရိတ် ခန့်မှန်းခြေ · စီမံကိန်းဆွေးနွေးရန်",
    appIntro: "ဤ simulator ကို အသုံးပြု၍ ခန်းမနှင့် ဝန်ဆောင်မှုရွေးချယ်မှုများသည် စုစုပေါင်းဘတ်ဂျက်ကို မည်ကဲ့သို့ သက်ရောက်သည်ကို စစ်ဆေးကြည့်ရှုနိုင်ပါသည်။ ဤဈေးနှုန်းများသည် ကိုးကားဆောင်ရွက်ရန် သာဖြစ်သည်။ တိကျသောကုန်ကျစရိတ်ကို Amore planner မှ အတည်ပြုပေးမည်ဖြစ်သည်။",
    guestCount: "ဧည့်သည်အရေအတွက်",
    date: "ရက်စွဲ",
    totalEstimate: "ခန့်မှန်းကြိုတင် ကုန်ကျစရိတ်",
    subtotalVenue: "ခန်းမနှင့် ဝန်ဆောင်မှုစရိတ်",
    subtotalAmore: "Amore ဝန်ဆောင်မှုများ",
    subtotal: "စုစုပေါင်း",
    tax: "အခွန် (၁၀%)",
    totalRange: "ခန့်မှန်းခြေ စုစုပေါင်း",
    disclaimer: "ဤစာရွက်စာတမ်းသည် ကနဦးကုန်ကျစရိတ် ခန့်မှန်းခြေ (simulation) သာဖြစ်ပြီး တရားဝင် ကမ်းလှမ်းစာ သို့မဟုတ် စာချုပ်မဟုတ်ပါ။ ကိန်းဂဏာန်းများအားလုံး ကိုးကားသုံးသပ်ရန်သာဖြစ်သည်။ တိကျသောကုန်ကျစရိတ်ကို Amore planner မှ ဆက်သွယ်ညှိနှိုင်းပြောဆိုပေးမည်ဖြစ်သည်။",
    budgetFriendlyNote: "ဘတ်ဂျက်နှင့်အညီ ညှိနှိုင်းလိုပါက ပွင့်လင်းလွတ်လပ်စွာ ဆွေးနွေးနိုင်ပါသည်။ လူကြီးမင်းတို့ စိတ်တိုင်းကျဖြစ်စေရန် ကျွန်ုပ်တို့ဘက်မှ အတတ်နိုင်ဆုံး ကူညီဆောင်ရွက်ပေးပါမည်။",
    menuBook: "ခန်းမစရိတ် တွက်ချက်ခြင်း",
    menuBookDesc: "ခန်းမစရိတ်ကို မည်သို့တွက်ချက်လိုသနည်း?",
    calcModeDetailed: "တစ်ခုချင်းစီ ရွေးချယ်မည်",
    calcModeDetailedDesc: "အစားအသောက်၊ အချိုရည်နှင့် အဆောင်အဦများကို ခွဲခြားရွေးချယ်ပါ။",
    calcModePerPerson: "တစ်ဦးလျှင် တစ်ပြေးညီနှုန်းထား",
    calcModePerPersonDesc: "ခန်းမ ဝန်ဆောင်မှု Package (တစ်ဦးလျှင်) စရိတ်ဖြင့် တွက်ချက်ပါ။",
    targetBudget: "သတ်မှတ်ဘတ်ဂျက်",
    budgetStatus: "ဘတ်ဂျက်သုံးစွဲမှု",
    remaining: "ပိုလျှံ",
    overBudget: "ဘတ်ဂျက်ကျော်",
    budgetSummary: "ဘတ်ဂျက် စီမံချက်",
    step1: "ဘတ်ဂျက်",
    step2: "ခန်းမ",
    step3: "Amore",
    step4: "အကျဉ်းချုပ်",
    guide: "လမ်းညွှန်",
    whySelect: "ဒါကို ဘာကြောင့် ရွေးချယ်သင့်သလဲ?",
    qualityVolume: "အရည်အသွေးနှင့် ပမာဏ",
    addToEstimate: "စာရင်းထဲထည့်မည်",
    removeFromEstimate: "ပယ်ဖျက်မည်",
    included: "စာရင်းထဲထည့်ပြီး",
    notIncluded: "မရွေးချယ်ရသေးပါ",
    nextStepAmore: "ရှေ့ဆက်မည်: Amore ဝန်ဆောင်မှုများ",
    generateSummary: "ကြိုတင်ခန့်မှန်းခြေ ကြည့်မည်",
    viewDocument: "Simulation ကြည့်မည်",
    estimateTotal: "ခန့်မှန်းစုစုပေါင်း (အခွန်အပါဝင်)",
    quantity: "အရေအတွက်",
    table: "စားပွဲ",
    perPerson: "တစ်ဦးလျှင်",
    recommendedVenues: "နမူနာခန်းမများ",
    recommendedVenuesDesc: "သင်ရွေးချယ်ထားသော အတိုင်းအတာအတွင်းရှိ ခန်းမများ (အများဆုံး ¥",
    venuePackageNote: "မှတ်ချက်- ဤခန်းမ Package ဈေးနှုန်းများတွင် အအစားအသောက်နှင့် အဖျော်ယမကာများအပြင် ပန်းအလှဆင်ခြင်း၊ ဝတ်စုံနှင့် အလှပြင်ခြင်း စသည့် ဝန်ဆောင်မှုများ ပါဝင်နေနိုင်ပါသည်။ အသေးစိတ်ကို သက်ဆိုင်ရာ ခန်းမ၏ တရားဝင် ဝဘ်ဆိုဒ်များတွင် စစ်ဆေးကြည့်ရှုပါ။",
    selectVenue: "ဤခန်းမကို ရွေးချယ်မည်",
    selected: "ရွေးချယ်ပြီး",
    serviceDetails: "ဝန်ဆောင်မှု အသေးစိတ်",
    generatedOn: "ထုတ်ပေးသည့်အချိန်",
    amoreTokyo: "Amore Wedding Tokyo",
    categories: {
      [QuoteCategory.VENUE_FEE]: 'ခန်းမနှင့် အဆောက်အအုံ',
      [QuoteCategory.FOOD_DRINK]: 'အစားအသောက်နှင့် အဖျော်ယမကာ',
      [QuoteCategory.ATTIRE_BEAUTY]: 'ဝတ်စုံနှင့် အလှပြင်',
      [QuoteCategory.FLORAL_DECOR]: 'ပန်းနှင့် အလှဆင်',
      [QuoteCategory.PHOTO_VIDEO]: 'ဓာတ်ပုံနှင့် ဗီဒီယို',
      [QuoteCategory.ENTERTAINMENT]: 'ဖျော်ဖြေရေးနှင့် အသံ',
      [QuoteCategory.OTHER]: 'အခြားဝန်ဆောင်မှုများ',
    }
  }
};

const INITIAL_SERVICES: (Omit<AmoreService, 'name'> & { name: Record<string, string> })[] = [
  { 
    id: '1', 
    name: { en: 'Event Planning Service + MC', ja: 'プランニング & 司会進行', my: 'မင်္ဂလာပွဲ စီစဉ်မှုနှင့် အခမ်းအနားမှူး' },
    minPrice: 105000, maxPrice: 220000, currentPrice: 105000,
    isSelected: false, 
    info: {
      en: "Professional coordination and MC services for the wedding banquet.",
      ja: "プロのコーディネートと披露宴の司会進行サービスです。",
      my: "မင်္ဂလာပွဲ အစီစဉ်တစ်ခုလုံး အဆင်ပြေစေရန် စီစဉ်ညှိနှိုင်းပေးခြင်းနှင့် အခမ်းအနားမှူး (MC) ဝန်ဆောင်မှု။"
    }
  },
  { 
    id: '2', 
    name: { en: 'Photo + Video', ja: '写真 & ビデオ撮影', my: 'ဓာတ်ပုံနှင့် ဗီဒီယို' },
    minPrice: 120000, maxPrice: 200000, currentPrice: 120000,
    isSelected: false, 
    info: {
      en: "Professional photography and videography for the event day.",
      ja: "当日の写真撮影とビデオ撮影のパッケージです。",
      my: "မင်္ဂလာပွဲနေ့ ဓာတ်ပုံနှင့် ဗီဒီယို မှတ်တမ်းတင်ခြင်း။"
    }
  },
  { 
    id: 'dress', 
    name: { en: 'Bride Dress & Groom Suit', ja: '新婦ドレス & 新郎タキシード', my: 'သတို့သမီးနှင့် သတို့သား ဝတ်စုံ' },
    minPrice: 35000, maxPrice: 75000, currentPrice: 35000,
    isSelected: false, 
    info: {
      en: "Rental for one wedding dress and one tuxedo set including accessories.",
      ja: "ドレス1着とタキシード1着のレンタルパッケージです。",
      my: "သတို့သမီးနှင့် သတို့သား ဝတ်စုံ ငှားရမ်းခနှင့် အသုံးအဆောင်များ။"
    }
  },
  { 
    id: 'makeup', 
    name: { en: 'Makeup & Hair (with Rehearsal)', ja: 'ヘアメイク (リハーサル込)', my: 'အလှပြင်နှင့် ဆံပင် (အစမ်းပြင်ဆင်မှုပါဝင်)' },
    minPrice: 35000, maxPrice: 85000, currentPrice: 35000,
    isSelected: false, 
    info: {
      en: "Professional bridal beauty service with a trial rehearsal.",
      ja: "当日のブライダルヘアメイクとリハーサルのセットです。",
      my: "သတို့သမီး အလှပြင်ဝန်ဆောင်မှုနှင့် အစမ်းပြင်ဆင်မှု။"
    }
  },
  { 
    id: 'amore_bouquet', 
    name: { en: 'Real Flower Bouquet', ja: '生花ブーケ', my: 'ပန်းအစစ် ပန်းစည်း' },
    minPrice: 10000, maxPrice: 50000, currentPrice: 20000,
    isSelected: false, 
    info: {
      en: "Fresh floral bouquet for the bride. Range depends on size and seasonality.",
      ja: "新婦用の生花ブーケです。サイズや季節により価格が変動します。",
      my: "သတို့သမီးအတွက် ပန်းအစစ် ပန်းစည်း။"
    }
  },
  { 
    id: 'amore_main_fl', 
    name: { en: 'Main Table Flowers', ja: 'メインテーブル装花', my: 'ပင်မစားပွဲ ပန်းအလှဆင်ခြင်း' },
    minPrice: 60000, maxPrice: 150000, currentPrice: 60000,
    isSelected: false, 
    info: {
      en: "Luxury floral arrangement for the couple's head table.",
      ja: "新郎新婦メインテーブルの豪華な装花演出です。",
      my: "သတို့သားသတို့သမီး ထိုင်သည့် ပင်မစားပွဲ ပန်းအလှဆင်ခြင်း။"
    }
  },
  { 
    id: 'amore_guest_fl', 
    name: { en: 'Guest Table Flowers (Set)', ja: 'ゲストテーブル装花 (セット)', my: 'ဧည့်သည်စားပွဲ ပန်းအလှဆင်ခြင်း' },
    minPrice: 3500, maxPrice: 15000, currentPrice: 3500,
    isSelected: false,
    quantity: 1, 
    info: {
      en: "Floral decor for all guest tables. Starts from 3,500 per table (max 10 guests).",
      ja: "ゲストテーブル用の装花です。1卓（最大10名）あたり3,500円より承ります。",
      my: "ဧည့်သည်စားပွဲ ပန်းအလှဆင်ခြင်း။ ၁ စားပွဲလျှင် ၃,၅၀၀ မှ စတင်ပါသည် (ဧည့်သည် ၁၀ ဦးအထိ)။"
    }
  },
  { 
    id: 'webinv', 
    name: { en: 'Web Invitation & Seating Chart', ja: 'WEB招待状 & 席次ボード', my: 'အွန်လိုင်း ဖိတ်စာနှင့် ဧည့်သည်နေရာပြဘုတ်' },
    minPrice: 10000, maxPrice: 25000, currentPrice: 10000,
    isSelected: false, 
    info: {
      en: "Digital wedding invitation and printed board for guest seating.",
      ja: "WEB招待状と出欠管理、当日用の席次ボードです。",
      my: "အွန်လိုင်း ဖိတ်စာနှင့် ဧည့်သည် နေရာထိုင်ခင်းပြ ဘုတ်။"
    }
  },
  { 
    id: 'transport', 
    name: { en: 'Transport Fee (交通費)', ja: 'スタッフ交通費・運搬費', my: 'သယ်ယူပို့ဆောင်ခ' },
    minPrice: 20000, maxPrice: 35000, currentPrice: 20000,
    isSelected: false, 
    info: {
      en: "Transportation costs for staff, apparel, and equipment to the venue.",
      ja: "スタッフや機材の搬入、移動に伴う交通費です。",
      my: "ဝန်ဆောင်မှုအဖွဲ့နှင့် ပစ္စည်းများအတွက် သယ်ယူပို့ဆောင်ခ။"
    }
  },
];

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('setup');
  const [language, setLanguage] = useState<Language>('en');
  const [expandedInfo, setExpandedInfo] = useState<string | null>(null);

  // Venue section state
  const [mandatoryPrices, setMandatoryPrices] = useState<Record<string, number>>(
    Object.fromEntries(VENUE_MANDATORY_ITEMS.map(i => [i.id, i.defaultPrice]))
  );
  const [foodPlan, setFoodPlan] = useState<FoodPlanType>('course');
  const [foodPricePerPerson, setFoodPricePerPerson] = useState(13000);
  const [drinksIncluded, setDrinksIncluded] = useState(true);
  const [drinkPricePerPerson, setDrinkPricePerPerson] = useState(3800);
  const [childCount, setChildCount] = useState(0);
  const CHILD_PRICE = 3500;
  const [selectedOptionals, setSelectedOptionals] = useState<Record<string, number>>({});

  // Amore section state
  const [amoreMode, setAmoreMode] = useState<'standard' | 'custom' | null>(null);
  const [amoreAddons, setAmoreAddons] = useState({
    dressCount: 1 as 0 | 1 | 2, sulyarYitPat: false,
    makeupRehearsal: true, makeupLooks: 1 as 1 | 2,
    realBouquet: false, guestFlowers: false, placingCards: false,
    photoUpgrade: false, aisleFlower: false,
  });
  const [addonPrices, setAddonPrices] = useState({ realBouquet: 20000, photoUpgrade: 40000, aisleFlower: 30000 });
  const [capturing, setCapturing] = useState(false);
  const [downloadTime, setDownloadTime] = useState<string>('');
  const [showPriceSettings, setShowPriceSettings] = useState(false);
  const [showTemplateModal, setShowTemplateModal] = useState(false);
  const [downloadingTemplate, setDownloadingTemplate] = useState(false);

  const isAdmin = new URLSearchParams(window.location.search).get('mode') === 'admin';

  const todayDate = new Date().toLocaleDateString(
    language === 'ja' ? 'ja-JP' : (language === 'my' ? 'my-MM' : 'en-US')
  );
  
  const [venueInfo, setVenueInfo] = useState<VenueInfo>({
    name: 'East Gallery Template',
    hideName: false,
    guestCount: 60,
    taxRate: 0.10,
    imageUrl: '',
    minimumUsageFee: undefined,
    targetBudget: 1500000 
  });
  
  const [quoteItems, setQuoteItems] = useState<QuoteItem[]>([]);
  const [amoreServices, setAmoreServices] = useState<AmoreService[]>(
    INITIAL_SERVICES.map(s => ({ ...s, name: s.name.en, quantity: s.id === 'amore_guest_fl' ? Math.ceil(60 / 10) : (s.quantity || 1) }))
  );

  // Addon questionnaire → service card auto-configuration
  useEffect(() => {
    if (amoreMode !== 'custom') return;
    setAmoreServices(prev => prev.map(s => {
      switch (s.id) {
        // Always-included services: just mark selected, leave price to user slider
        case '1':
        case '2':
        case 'amore_main_fl':
        case 'webinv':
        case 'transport':
          return { ...s, isSelected: true };
        // Dress: can be excluded (なし = dressCount 0)
        case 'dress':
          return { ...s, isSelected: amoreAddons.dressCount > 0 };
        // Makeup: range driven by look count × rehearsal toggle
        case 'makeup': {
          const ranges: Record<string, [number, number]> = {
            '1':  [25000,  55000],
            '1R': [35000,  85000],
            '2':  [45000,  90000],
            '2R': [55000, 110000],
          };
          const key = `${amoreAddons.makeupLooks}${amoreAddons.makeupRehearsal ? 'R' : ''}`;
          const [newMin, newMax] = ranges[key];
          return { ...s, isSelected: true, minPrice: newMin, maxPrice: newMax,
                   currentPrice: Math.min(Math.max(s.currentPrice, newMin), newMax) };
        }
        // Optional services: toggled by questionnaire answers
        case 'amore_bouquet':
          return { ...s, isSelected: amoreAddons.realBouquet, currentPrice: addonPrices.realBouquet };
        case 'amore_guest_fl':
          return { ...s, isSelected: amoreAddons.guestFlowers, quantity: Math.ceil(venueInfo.guestCount / 10) };
        default:
          return s;
      }
    }));
  }, [amoreMode, amoreAddons, addonPrices, venueInfo.guestCount]);

  useEffect(() => {
    if (amoreMode === 'standard') {
      setAmoreServices(prev => prev.map(s => ({ ...s, isSelected: ['1','2','amore_main_fl','makeup','webinv','transport'].includes(s.id) })));
    } else if (amoreMode === null) {
      setAmoreServices(prev => prev.map(s => ({ ...s, isSelected: false })));
    }
  }, [amoreMode]);

  const t = TRANSLATIONS[language];

  const getServiceName = (id: string) => {
    const original = INITIAL_SERVICES.find(s => s.id === id);
    return original?.name[language] || original?.name.en || "";
  };

  const getAmoreOptionText = (service: AmoreService) => {
    const configs: Record<string, Record<string, string>> = {
      '1': {
        en: amoreAddons.sulyarYitPat ? "Includes Sulryar Yit Pat (Myanmar ceremony)." : "Standard planning & MC.",
        ja: amoreAddons.sulyarYitPat ? "ミャンマー伝統儀式（スリヤ・イッパ）対応。" : "スタンダードな披露宴進行のみ。",
        my: amoreAddons.sulyarYitPat ? "မြန်မာရိုးရာ စုလျားရစ်ပတ် မင်္ဂလာအခမ်းအနား ပါဝင်သည်။" : "ပွဲတော် စီစဉ်မှုနှင့် MC ဝန်ဆောင်မှု"
      },
      'amore_main_fl': {
        en: service.currentPrice >= 120000 ? "One Rank Up Luxury Floral" : "Standard Main Table Arrangement",
        ja: service.currentPrice >= 120000 ? "ワンランク上の豪華装花演出" : "標準メインテーブル装花",
        my: service.currentPrice >= 120000 ? "အဆင့်မြင့် ပန်းအလှဆင်မှု" : "စံနှုန်းမီ ပင်မစားပွဲ ပန်းအလှဆင်မှု"
      },
      '2': {
        en: amoreAddons.photoUpgrade ? "Upgraded photo/video size included." : "Standard day-of recording.",
        ja: amoreAddons.photoUpgrade ? "フォトサイズアップグレード込み。" : "標準当日記録撮影。",
        my: amoreAddons.photoUpgrade ? "ဓာတ်ပုံ/ဗီဒီယို အဆင့်မြင့် ပါဝင်သည်။" : "စံနှုန်းမီ မင်္ဂလာပွဲနေ့ မှတ်တမ်း"
      },
      'dress': {
        en: amoreAddons.dressCount === 0 ? "No dress rental — excluded from total." : amoreAddons.dressCount >= 2 ? "2 dresses + groom suit with accessories." : "1 dress + groom suit with accessories.",
        ja: amoreAddons.dressCount === 0 ? "衣装なし（合計から除外）。" : amoreAddons.dressCount >= 2 ? "ドレス2点 & タキシードと小物一式のセット。" : "ドレス1点 & タキシードと小物一式のセット。",
        my: amoreAddons.dressCount === 0 ? "ဝတ်စုံ မပါ (စုစုပေါင်းမှ ဖယ်ထုတ်)" : amoreAddons.dressCount >= 2 ? "ဝတ်စုံ ၂ စုံနှင့် အသုံးအဆောင်များ" : "ဝတ်စုံ ၁ စုံနှင့် အသုံးအဆောင်များ"
      },
      'makeup': {
        en: `Bridal hair & makeup — ${amoreAddons.makeupLooks === 2 ? '2 looks' : '1 look'}${amoreAddons.makeupRehearsal ? ' + rehearsal' : ''}.`,
        ja: `ヘアメイク（新婦）— ${amoreAddons.makeupLooks === 2 ? '2ルック' : '1ルック'}${amoreAddons.makeupRehearsal ? ' + リハーサル込み' : ''}。`,
        my: `မင်္ဂလာပွဲနေ့ ဆံပင်/အလှပြင် — ${amoreAddons.makeupLooks === 2 ? '၂ ကြိမ်' : '၁ ကြိမ်'}${amoreAddons.makeupRehearsal ? ' + အစမ်းပါ' : ''}`,
      },
      'webinv': {
        en: amoreAddons.placingCards ? `Web invitation + place cards (¥${AMORE_ADDON_CONFIG.placingCardPerPerson}/person).` : "Web invitation & seating chart.",
        ja: amoreAddons.placingCards ? `Web招待状 + 席札（¥${AMORE_ADDON_CONFIG.placingCardPerPerson}/人）。` : "Web招待状 & 席次ボード。",
        my: amoreAddons.placingCards ? `Web ဖိတ်စာ + နေရာကတ်ပြား (¥${AMORE_ADDON_CONFIG.placingCardPerPerson}/ဦး)။` : "Web ဖိတ်စာနှင့် ဧည့်သည်နေရာပြ ဘုတ်"
      }
    };

    return configs[service.id]?.[language] || configs[service.id]?.en || "";
  };

  const handleDownloadImage = async () => {
    const now = new Date();
    const timeStr = now.toLocaleString(language === 'ja' ? 'ja-JP' : (language === 'my' ? 'my-MM' : 'en-US'));
    setDownloadTime(timeStr);
    
    // Wait for the state update and render
    setTimeout(async () => {
      const element = document.getElementById('quote-content');
      if (!element) return;
      setCapturing(true);
      try {
        const canvas = await html2canvas(element, { scale: 2, useCORS: true });
        const link = document.createElement('a');
        link.download = `amore-estimate-${Date.now()}.png`;
        link.href = canvas.toDataURL('image/png');
        link.click();
      } catch (e) {
        console.error("Export failed", e);
      } finally {
        setCapturing(false);
      }
    }, 100);
  };

  const resetToHinmokuPrices = () => {
    setAmoreServices(prev => prev.map(s =>
      HINMOKU_MASTER_PRICES[s.id] !== undefined
        ? { ...s, currentPrice: HINMOKU_MASTER_PRICES[s.id] }
        : s
    ));
  };

  const handleDownloadTemplate = async () => {
    const element = document.getElementById('template-quote-content');
    if (!element) return;
    setDownloadingTemplate(true);
    try {
      const canvas = await html2canvas(element, { scale: 2, useCORS: true, backgroundColor: '#ffffff' });
      const link = document.createElement('a');
      link.download = `mitsumori-${Date.now()}.png`;
      link.href = canvas.toDataURL('image/png');
      link.click();
    } catch (e) {
      console.error('Template export failed', e);
    } finally {
      setDownloadingTemplate(false);
    }
  };

  const updateItemQty = (name: string, delta: number) => {
    setQuoteItems(prev => prev.map(item => {
      if (item.name === name) {
        return { ...item, quantity: Math.max(0, item.quantity + delta) };
      }
      return item;
    }));
  };

  const updateItemPrice = (name: string, price: number) => {
    setQuoteItems(prev => prev.map(item => {
      if (item.name === name) {
        return { ...item, unitPrice: price };
      }
      return item;
    }));
  };

  const toggleCatalogItem = (catalogItem: CatalogItem) => {
    const itemNameEn = catalogItem.name.en;
    setQuoteItems(prev => {
      const exists = prev.find(i => i.name === itemNameEn);
      if (exists) {
        return prev.filter(i => i.name !== itemNameEn);
      } else {
        const newItem: QuoteItem = {
          id: crypto.randomUUID(),
          category: catalogItem.category === 'Plan' ? QuoteCategory.VENUE_FEE : catalogItem.category as QuoteCategory,
          name: itemNameEn, 
          unitPrice: catalogItem.unitPrice,
          quantity: catalogItem.isPerGuest ? venueInfo.guestCount : catalogItem.defaultQty,
          isPerGuest: catalogItem.isPerGuest,
          description: catalogItem.info?.[language] || catalogItem.info?.en,
          info: catalogItem.info?.[language] || catalogItem.info?.['en'],
          minPrice: catalogItem.minPrice,
          maxPrice: catalogItem.maxPrice
        };
        return [...prev, newItem];
      }
    });
  };

  const toggleAmoreService = (id: string) => {
    setAmoreServices(prev => prev.map(s => 
      s.id === id ? { ...s, isSelected: !s.isSelected } : s
    ));
  };

  const updateAmorePrice = (id: string, price: number) => {
    setAmoreServices(prev => prev.map(s => 
      s.id === id ? { ...s, currentPrice: price } : s
    ));
  };

  const updateAmoreQty = (id: string, delta: number) => {
    setAmoreServices(prev => prev.map(s => 
      s.id === id ? { ...s, quantity: Math.max(1, (s.quantity || 1) + delta) } : s
    ));
  };

  // Addon-inclusive price for each service (base slider + questionnaire addons on top)
  const getEffectivePrice = (service: AmoreService): number => {
    let p = service.currentPrice;
    if (service.id === 'dress' && amoreAddons.dressCount >= 2) p += AMORE_ADDON_CONFIG.dressSecond;
    if (service.id === '1'     && amoreAddons.sulyarYitPat)    p += AMORE_ADDON_CONFIG.sulyarYitPat;
    if (service.id === '2'     && amoreAddons.photoUpgrade)    p += addonPrices.photoUpgrade;
    if (service.id === 'webinv'&& amoreAddons.placingCards)    p += venueInfo.guestCount * AMORE_ADDON_CONFIG.placingCardPerPerson;
    return p;
  };

  // ── Totals ──
  const venueFoodTotal  = foodPricePerPerson * venueInfo.guestCount;
  const venueDrinkTotal = drinksIncluded ? drinkPricePerPerson * venueInfo.guestCount : 0;
  const venueChildTotal = CHILD_PRICE * childCount;
  const venueOptTotal   = Object.entries(selectedOptionals).reduce((sum, [id, price]: [string, number]) => {
    const item = VENUE_OPTIONAL_ITEMS.find(i => i.id === id);
    return item ? sum + (item.isPerGuest ? price * venueInfo.guestCount : price) : sum;
  }, 0);
  const venueMandatoryTotal = VENUE_MANDATORY_ITEMS.reduce((sum, item) => sum + (mandatoryPrices[item.id] ?? item.defaultPrice), 0);
  const venueSubtotal = venueMandatoryTotal + venueFoodTotal + venueDrinkTotal + venueChildTotal + venueOptTotal;

  let amoreSubtotal = 0;
  if (amoreMode === 'standard') {
    amoreSubtotal = AMORE_STANDARD_PRETAX;
  } else if (amoreMode === 'custom') {
    amoreSubtotal = amoreServices.filter(s => s.isSelected).reduce((sum, s) => sum + getEffectivePrice(s) * (s.quantity || 1), 0);
    if (amoreAddons.aisleFlower) amoreSubtotal += addonPrices.aisleFlower;
  }
  
  const subtotalBeforeTax = venueSubtotal + amoreSubtotal;
  const taxAmount = Math.floor(subtotalBeforeTax * venueInfo.taxRate);
  const grandTotal = subtotalBeforeTax + taxAmount;
  
  const isOverBudget = venueInfo.targetBudget ? grandTotal > venueInfo.targetBudget : false;
  const budgetUsage = venueInfo.targetBudget ? (grandTotal / venueInfo.targetBudget) * 100 : 0;
  const targetBudgetPerPerson = venueInfo.targetBudget && venueInfo.guestCount > 0 ? Math.round(venueInfo.targetBudget / venueInfo.guestCount) : 0;

  const selectedAmoreServices = amoreServices.filter(s => s.isSelected);

  const steps = [
    { id: 'setup', label: t.step1, icon: <Wallet size={16}/> },
    { id: 'catalog', label: t.step2, icon: <BookOpen size={16}/> },
    { id: 'amore', label: t.step3, icon: <LayoutGrid size={16}/> },
    { id: 'preview', label: t.step4, icon: <FileText size={16}/> }
  ];

  return (
    <div className={`min-h-screen bg-gray-50/50 text-gray-800 font-sans pb-48 print:bg-white print:pb-0 print:text-black ${language === 'my' ? 'font-[Padauk]' : ''}`}>
      <header className="bg-white border-b border-rose-100 shadow-sm sticky top-0 z-40 no-print">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 py-4 flex flex-col sm:flex-row justify-between items-center gap-4">
          <div className="flex items-center gap-2 text-amore-600">
            <Heart className="fill-amore-500" />
            <span className="font-serif text-xl sm:text-2xl font-bold tracking-tight">{t.amoreTokyo}</span>
          </div>
          <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-lg">
             {(['en', 'ja', 'my'] as const).map(l => (
               <button key={l} onClick={() => setLanguage(l)} className={`px-3 sm:px-4 py-1.5 text-xs font-bold rounded-md transition-all ${language === l ? 'bg-white shadow text-amore-600' : 'text-gray-500 hover:text-gray-700'}`}>
                 {l === 'en' ? 'EN' : l === 'ja' ? '日本語' : 'မြန်မာ'}
               </button>
             ))}
          </div>
        </div>
      </header>
      
      <div className="max-w-7xl mx-auto px-4 sm:px-6 mt-8 no-print">
        <div className="flex items-center justify-between bg-white border border-gray-100 p-2 rounded-2xl shadow-sm overflow-x-auto">
          {steps.map((step, index) => (
            <React.Fragment key={step.id}>
              <button 
                onClick={() => setActiveTab(step.id as TabType)} 
                className={`flex-1 min-w-[80px] sm:min-w-[100px] flex flex-col items-center justify-center py-2 sm:py-4 rounded-xl transition-all relative ${activeTab === step.id ? 'bg-amore-50 text-amore-600 font-bold' : 'text-gray-400'}`}
              >
                <div className={`w-8 h-8 sm:w-10 sm:h-10 rounded-full flex items-center justify-center mb-2 border-2 transition-all ${activeTab === step.id ? 'bg-white border-amore-500 text-amore-600 shadow-md scale-105 sm:scale-110' : 'bg-gray-50 border-gray-100'}`}>
                  {React.cloneElement(step.icon, { size: 14, className: "sm:hidden"})}
                  {React.cloneElement(step.icon, { size: 16, className: "hidden sm:block"})}
                </div>
                <span className="text-[10px] uppercase tracking-widest">{step.label}</span>
              </button>
              {index < steps.length - 1 && <div className="text-gray-200"><ArrowRight size={16} /></div>}
            </React.Fragment>
          ))}
        </div>
      </div>

      <main className="max-w-7xl mx-auto px-4 sm:px-6 py-8">
        <div className={activeTab === 'setup' ? 'block animate-in fade-in' : 'hidden'}>
           <section className="bg-white rounded-[2rem] p-6 md:p-10 lg:p-14 shadow-xl border border-gray-100 space-y-12">
              <div className="bg-rose-50 border border-rose-100 p-6 rounded-3xl">
                <p className="text-amore-700 font-medium leading-relaxed italic text-center text-sm sm:text-base">
                  {t.appIntro}
                </p>
              </div>

              <div className="flex flex-col lg:flex-row gap-16">
                 <div className="flex-[2] space-y-12">
                    <h2 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900">{t.budgetSummary}</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-10">
                       <div className="space-y-4">
                          <label className="text-xs font-black text-gray-400 uppercase tracking-widest">{t.targetBudget}</label>
                          <div className="relative">
                             <span className="absolute left-4 sm:left-6 top-1/2 -translate-y-1/2 text-2xl sm:text-3xl font-serif text-amore-400">¥</span>
                             <input type="number" value={venueInfo.targetBudget || ''} onChange={(e) => setVenueInfo(prev => ({...prev, targetBudget: Number(e.target.value)}))} className="w-full bg-gray-50 rounded-3xl pl-10 sm:pl-12 pr-6 sm:pr-8 py-6 sm:py-8 text-3xl sm:text-4xl font-serif font-bold text-gray-900 focus:bg-white outline-none" placeholder="0" />
                          </div>
                          {venueInfo.targetBudget && (
                            <div className="flex items-center gap-2 text-sm text-gray-500 font-medium bg-gray-50 px-4 py-2 rounded-full w-fit">
                              <Users size={14} className="text-amore-400" />
                              ¥{targetBudgetPerPerson.toLocaleString()} <span className="text-[10px] uppercase font-black tracking-tighter opacity-70">{t.perPerson}</span>
                            </div>
                          )}
                       </div>
                    </div>
                    
                    <div className="pt-8 flex justify-center">
                       <button onClick={() => setActiveTab('catalog')} className="bg-gray-900 text-white px-10 py-4 rounded-2xl font-bold flex items-center gap-2 hover:bg-black transition-all shadow-lg group">
                          Next: {t.step2} <ArrowRight className="group-hover:translate-x-1 transition-transform" />
                       </button>
                    </div>
                 </div>
              </div>
           </section>
        </div>

        <div className={activeTab === 'catalog' ? 'block space-y-8 animate-in slide-in-from-bottom-4' : 'hidden'}>
           <header className="text-center max-w-2xl mx-auto space-y-2">
             <h2 className="text-3xl sm:text-4xl font-serif font-bold text-gray-900">会場費用</h2>
             <p className="text-gray-500 text-sm">Venue Cost Setup</p>
           </header>

           {/* ── Section 1: Venue Package (mandatory items) ── */}
           <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 sm:p-10 space-y-6">
             <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
               <div className="w-7 h-7 rounded-full bg-amore-500 text-white flex items-center justify-center text-xs font-black">1</div>
               <div>
                 <h3 className="font-bold text-gray-900">会場パッケージ料金</h3>
                 <p className="text-xs text-gray-400">Venue Package — 必須項目（全て含まれます）</p>
               </div>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {VENUE_MANDATORY_ITEMS.map(item => {
                 const price = mandatoryPrices[item.id] ?? item.defaultPrice;
                 return (
                   <div key={item.id} className="rounded-2xl border-2 border-amore-200 bg-amore-50/30 overflow-hidden">
                     <div className="p-4 flex items-center justify-between">
                       <div>
                         <div className="font-medium text-sm text-gray-800">{item.ja}</div>
                         <div className="text-[10px] text-gray-400 mt-0.5">¥{item.minPrice.toLocaleString()}–¥{item.maxPrice.toLocaleString()}</div>
                       </div>
                       <div className="flex items-center gap-2 shrink-0">
                         <span className="text-[9px] bg-amore-100 text-amore-600 font-black px-2 py-0.5 rounded-full uppercase tracking-wide">必須</span>
                         <div className="w-8 h-8 rounded-full bg-amore-500 text-white flex items-center justify-center shrink-0">
                           <Check size={14} />
                         </div>
                       </div>
                     </div>
                     <div className="px-4 pb-4 space-y-2">
                       <div className="flex justify-between items-center text-xs">
                         <span className="text-gray-500">/ {item.unit}</span>
                         <div className="flex items-center gap-1">
                           <span className="text-gray-400 font-mono">¥</span>
                           <input
                             type="number"
                             min={item.minPrice}
                             max={item.maxPrice}
                             step={1000}
                             value={price}
                             onChange={e => {
                               const v = Number(e.target.value);
                               if (!isNaN(v)) setMandatoryPrices(prev => ({...prev, [item.id]: v}));
                             }}
                             onBlur={e => {
                               const v = Math.min(item.maxPrice, Math.max(item.minPrice, Number(e.target.value) || item.defaultPrice));
                               setMandatoryPrices(prev => ({...prev, [item.id]: v}));
                             }}
                             className="w-28 text-right font-mono font-bold text-amore-600 bg-transparent border-b border-amore-200 focus:outline-none focus:border-amore-500"
                           />
                         </div>
                       </div>
                       <input type="range" min={item.minPrice} max={item.maxPrice} step={5000}
                         value={Math.min(item.maxPrice, Math.max(item.minPrice, price))}
                         onChange={e => setMandatoryPrices(prev => ({...prev, [item.id]: Number(e.target.value)}))}
                         className="w-full h-2 bg-white rounded-lg appearance-none cursor-pointer accent-amore-500" />
                       <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                         <span>¥{item.minPrice.toLocaleString()}</span><span>¥{item.maxPrice.toLocaleString()}</span>
                       </div>
                     </div>
                   </div>
                 );
               })}
             </div>
             <div className="flex justify-between items-center border-t border-amore-100 pt-3">
               <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Section 1 小計</span>
               <span className="font-mono font-bold text-amore-700">¥{venueMandatoryTotal.toLocaleString()}</span>
             </div>
             <p className="text-xs text-gray-400 italic">※ スライダーで会場ごとの参考価格に調整してください。</p>
           </div>

           {/* ── Section 2: Food & Drink ── */}
           <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 sm:p-10 space-y-6">
             <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
               <div className="w-7 h-7 rounded-full bg-amore-500 text-white flex items-center justify-center text-xs font-black">2</div>
               <div>
                 <h3 className="font-bold text-gray-900">料理・飲み物</h3>
                 <p className="text-xs text-gray-400">Food & Drink — ゲスト人数に連動</p>
               </div>
             </div>
             {/* Food plan selector */}
             <div className="space-y-4">
               <p className="text-xs font-black uppercase text-gray-400 tracking-widest">料理プラン</p>
               <div className="grid grid-cols-3 gap-3">
                 {(Object.keys(FOOD_PLANS) as FoodPlanType[]).map(plan => (
                   <button key={plan} onClick={() => { setFoodPlan(plan); setFoodPricePerPerson(FOOD_PLANS[plan].defaultPrice); }}
                     className={`py-3 px-2 rounded-2xl border-2 text-center transition-all ${foodPlan === plan ? 'bg-white border-amore-500 shadow-md text-amore-700' : 'bg-gray-50 border-gray-100 text-gray-500 hover:border-amore-200'}`}>
                     <div className="font-bold text-xs">{FOOD_PLANS[plan].ja}</div>
                     <div className="text-[10px] text-gray-400 mt-0.5">¥{FOOD_PLANS[plan].minPrice.toLocaleString()}~</div>
                   </button>
                 ))}
               </div>
               <div className="bg-gray-50 rounded-2xl p-4 space-y-3">
                 <div className="flex justify-between items-baseline">
                   <span className="text-xs text-gray-500">{FOOD_PLANS[foodPlan].ja} / 人</span>
                   <span className="font-mono font-bold text-amore-600">¥{foodPricePerPerson.toLocaleString()} × {venueInfo.guestCount} = ¥{(foodPricePerPerson * venueInfo.guestCount).toLocaleString()}</span>
                 </div>
                 <input type="range" min={FOOD_PLANS[foodPlan].minPrice} max={FOOD_PLANS[foodPlan].maxPrice} step={500}
                   value={foodPricePerPerson} onChange={e => setFoodPricePerPerson(Number(e.target.value))}
                   className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amore-500" />
                 <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                   <span>¥{FOOD_PLANS[foodPlan].minPrice.toLocaleString()}</span><span>¥{FOOD_PLANS[foodPlan].maxPrice.toLocaleString()}</span>
                 </div>
               </div>
             </div>
             {/* Drinks */}
             <div className="space-y-3">
               <div className="flex items-center justify-between">
                 <p className="text-xs font-black uppercase text-gray-400 tracking-widest">フリードリンク</p>
                 <button onClick={() => setDrinksIncluded(p => !p)}
                   className={`px-4 py-1.5 rounded-xl text-xs font-bold transition-all ${drinksIncluded ? 'bg-amore-500 text-white' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                   {drinksIncluded ? '含む' : '含まない'}
                 </button>
               </div>
               {drinksIncluded && (
                 <div className="bg-gray-50 rounded-2xl p-4 space-y-3 animate-in zoom-in-95">
                   <div className="flex justify-between">
                     <span className="text-xs text-gray-500">フリードリンク / 人</span>
                     <span className="font-mono font-bold text-amore-600">¥{drinkPricePerPerson.toLocaleString()} × {venueInfo.guestCount} = ¥{(drinkPricePerPerson * venueInfo.guestCount).toLocaleString()}</span>
                   </div>
                   <input type="range" min={2500} max={5000} step={100} value={drinkPricePerPerson}
                     onChange={e => setDrinkPricePerPerson(Number(e.target.value))}
                     className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amore-500" />
                   <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                     <span>¥2,500</span><span>¥5,000</span>
                   </div>
                 </div>
               )}
             </div>
             {/* Children */}
             <div className="flex items-center justify-between bg-gray-50 rounded-2xl p-4">
               <div>
                 <p className="text-xs font-black uppercase text-gray-400 tracking-widest">お子様</p>
                 <p className="text-[10px] text-gray-400 mt-0.5">¥{CHILD_PRICE.toLocaleString()} / 人</p>
               </div>
               <div className="flex items-center gap-3">
                 <button onClick={() => setChildCount(p => Math.max(0, p-1))} className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"><Minus size={14} /></button>
                 <span className="text-lg font-mono font-bold w-6 text-center">{childCount}</span>
                 <button onClick={() => setChildCount(p => p+1)} className="p-1.5 rounded-lg bg-white border border-gray-200 text-gray-500 hover:bg-gray-100"><Plus size={14} /></button>
               </div>
             </div>
             <div className="flex justify-between items-center border-t border-gray-100 pt-3">
               <span className="text-xs text-gray-400 font-bold uppercase tracking-widest">Section 2 小計</span>
               <span className="font-mono font-bold text-gray-900">¥{(venueFoodTotal + venueDrinkTotal + venueChildTotal).toLocaleString()}</span>
             </div>
           </div>

           {/* ── Section 3: Optional items ── */}
           <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 sm:p-10 space-y-6">
             <div className="flex items-center gap-3 border-b border-gray-50 pb-4">
               <div className="w-7 h-7 rounded-full bg-gray-400 text-white flex items-center justify-center text-xs font-black">3</div>
               <div>
                 <h3 className="font-bold text-gray-900">オプション項目</h3>
                 <p className="text-xs text-gray-400">Optional Items (品目マスタ) — 必要に応じて追加</p>
               </div>
             </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               {VENUE_OPTIONAL_ITEMS.map(item => {
                 const isSelected = item.id in selectedOptionals;
                 const currentPrice = selectedOptionals[item.id] ?? item.defaultPrice;
                 const effectiveTotal = item.isPerGuest ? currentPrice * venueInfo.guestCount : currentPrice;
                 return (
                   <div key={item.id} className={`rounded-2xl border-2 transition-all overflow-hidden ${isSelected ? 'border-amore-300 bg-white shadow-sm' : 'border-gray-100 bg-gray-50'}`}>
                     <div className="p-4 flex items-center justify-between">
                       <div>
                         <div className="font-medium text-sm text-gray-800">{item.ja}</div>
                         <div className="text-[10px] text-gray-400 mt-0.5">{item.isPerGuest ? `¥${item.minPrice.toLocaleString()}–¥${item.maxPrice.toLocaleString()} / ${item.unit}` : `¥${item.minPrice.toLocaleString()}–¥${item.maxPrice.toLocaleString()}`}</div>
                       </div>
                       <button onClick={() => setSelectedOptionals(prev => {
                         if (isSelected) { const n = {...prev}; delete n[item.id]; return n; }
                         return {...prev, [item.id]: item.defaultPrice};
                       })} className={`w-8 h-8 rounded-full flex items-center justify-center border-2 transition-all ${isSelected ? 'bg-amore-500 border-amore-500 text-white' : 'bg-white border-gray-200 text-gray-300 hover:border-amore-300'}`}>
                         {isSelected ? <Check size={14} /> : <Plus size={14} />}
                       </button>
                     </div>
                     {isSelected && (
                       <div className="px-4 pb-4 space-y-2 animate-in zoom-in-95">
                         <div className="flex justify-between text-xs">
                           <span className="text-gray-500">{item.isPerGuest ? `¥${currentPrice.toLocaleString()} × ${venueInfo.guestCount}` : `¥${currentPrice.toLocaleString()}`}</span>
                           <span className="font-mono font-bold text-amore-600">= ¥{effectiveTotal.toLocaleString()}</span>
                         </div>
                         <input type="range" min={item.minPrice} max={item.maxPrice} step={item.isPerGuest ? 100 : 1000}
                           value={currentPrice} onChange={e => setSelectedOptionals(prev => ({...prev, [item.id]: Number(e.target.value)}))}
                           className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amore-500" />
                         <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                           <span>¥{item.minPrice.toLocaleString()}</span><span>¥{item.maxPrice.toLocaleString()}</span>
                         </div>
                       </div>
                     )}
                   </div>
                 );
               })}
             </div>
           </div>

           <div className="flex justify-center pt-4 border-t border-gray-100">
              <button onClick={() => setActiveTab('amore')} className="bg-gray-900 text-white px-8 sm:px-12 py-4 sm:py-5 rounded-2xl font-bold flex items-center gap-3 hover:bg-black transition-all shadow-xl group">
                 {t.nextStepAmore} <ChevronRight className="group-hover:translate-x-1 transition-transform" />
              </button>
           </div>
        </div>



        <div className={activeTab === 'amore' ? 'block space-y-10 animate-in' : 'hidden'}>
           <header className="text-center max-w-2xl mx-auto">
             <div className="flex items-center justify-center gap-3">
               <h2 className="text-3xl sm:text-4xl font-serif font-bold">Amore サービス</h2>
               {isAdmin && (
                 <button onClick={() => setShowPriceSettings(true)}
                   className="p-2.5 rounded-xl bg-gray-100 hover:bg-amore-100 text-gray-500 hover:text-amore-600 transition-colors"
                   title="品目マスタ 価格設定">
                   <Settings size={18} />
                 </button>
               )}
             </div>
             <p className="text-gray-500 mt-2 text-sm">Choose how to configure Amore services.</p>
           </header>

           {/* ── Mode selector ── */}
           <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-3xl mx-auto">
             {/* Standard package card */}
             <button onClick={() => setAmoreMode(amoreMode === 'standard' ? null : 'standard')}
               className={`relative flex flex-col items-start gap-4 p-6 sm:p-8 rounded-3xl border-2 text-left transition-all ${amoreMode === 'standard' ? 'bg-white border-amore-500 shadow-xl ring-4 ring-rose-50' : 'bg-gray-50 border-gray-100 hover:border-amore-200'}`}>
               {amoreMode === 'standard' && <div className="absolute top-3 right-3 w-6 h-6 bg-amore-500 rounded-full flex items-center justify-center"><Check size={12} className="text-white" /></div>}
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${amoreMode === 'standard' ? 'bg-amore-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                 <Award size={28} />
               </div>
               <div>
                 <div className="font-bold text-lg text-gray-900">スタンダードパッケージ</div>
                 <div className="text-3xl font-serif font-bold text-amore-600 mt-1">¥407,000 <span className="text-sm text-gray-400 font-normal">税込</span></div>
                 <div className="text-xs text-gray-400 mt-1">¥{AMORE_STANDARD_PRETAX.toLocaleString()} + 税</div>
               </div>
               <div className="flex flex-wrap gap-1.5 w-full">
                 {AMORE_STANDARD_INCLUDES.map(inc => (
                   <span key={inc.ja} className="text-[10px] bg-amore-50 border border-amore-100 text-amore-700 rounded-full px-2 py-0.5 font-medium">
                     {inc.ja} ¥{inc.price.toLocaleString()}
                   </span>
                 ))}
               </div>
             </button>

             {/* Custom card */}
             <button onClick={() => setAmoreMode(amoreMode === 'custom' ? null : 'custom')}
               className={`relative flex flex-col items-start gap-4 p-6 sm:p-8 rounded-3xl border-2 text-left transition-all ${amoreMode === 'custom' ? 'bg-white border-amore-500 shadow-xl ring-4 ring-rose-50' : 'bg-gray-50 border-gray-100 hover:border-amore-200'}`}>
               {amoreMode === 'custom' && <div className="absolute top-3 right-3 w-6 h-6 bg-amore-500 rounded-full flex items-center justify-center"><Check size={12} className="text-white" /></div>}
               <div className={`w-14 h-14 rounded-2xl flex items-center justify-center ${amoreMode === 'custom' ? 'bg-amore-500 text-white' : 'bg-gray-200 text-gray-400'}`}>
                 <ListChecks size={28} />
               </div>
               <div>
                 <div className="font-bold text-lg text-gray-900">カスタム選択</div>
                 <div className="text-sm text-gray-500 mt-1">個別サービスを選択してカスタマイズ</div>
                 <div className="text-sm text-gray-400">Custom individual services</div>
               </div>
             </button>
           </div>

           {/* ── Custom mode: questionnaire + auto-configured cards ── */}
           {amoreMode === 'custom' && (
             <div className="space-y-8 animate-in fade-in">
               {/* Questionnaire */}
               <div className="bg-white rounded-[2rem] border border-gray-100 shadow-sm p-6 sm:p-10 space-y-0 divide-y divide-gray-50">
                 <div className="flex items-center gap-3 pb-5">
                   <div className="w-7 h-7 rounded-full bg-amore-500 text-white flex items-center justify-center text-xs font-black">Q</div>
                   <div>
                     <h3 className="font-bold text-gray-900">サービス構成を選択</h3>
                     <p className="text-xs text-gray-400">Answer to auto-configure prices below</p>
                   </div>
                 </div>

                 {/* Dress count */}
                 <div className="flex items-center justify-between py-4">
                   <div><div className="text-sm font-medium text-gray-800">衣装レンタル</div><div className="text-[10px] text-gray-400">なし → 合計から除外 / 2着目 +¥{AMORE_ADDON_CONFIG.dressSecond.toLocaleString()}</div></div>
                   <div className="flex gap-2">
                     {([0,1,2] as const).map(n => (
                       <button key={n} onClick={() => setAmoreAddons(p => ({...p, dressCount: n}))}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                           amoreAddons.dressCount === n
                             ? n === 0 ? 'bg-gray-400 text-white shadow-sm' : 'bg-amore-500 text-white shadow-sm'
                             : 'bg-gray-100 text-gray-500 hover:bg-gray-200'
                         }`}>
                         {n === 0 ? 'なし' : `${n}着${n===2?'+':''}`}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Sulryar Yit Pat */}
                 <div className="flex items-center justify-between py-4">
                   <div><div className="text-sm font-medium text-gray-800">スリャーイッパ</div><div className="text-[10px] text-gray-400">ミャンマー伝統式 +¥{AMORE_ADDON_CONFIG.sulyarYitPat.toLocaleString()}</div></div>
                   <div className="flex gap-2">
                     {([true,false] as const).map(v => (
                       <button key={String(v)} onClick={() => setAmoreAddons(p => ({...p, sulyarYitPat: v}))}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${amoreAddons.sulyarYitPat===v ? (v?'bg-amore-500 text-white shadow-sm':'bg-gray-300 text-gray-700') : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                         {v?'あり':'なし'}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Makeup looks */}
                 <div className="flex items-center justify-between py-4">
                   <div><div className="text-sm font-medium text-gray-800">ヘアメイク ルック数</div><div className="text-[10px] text-gray-400">1 look / 2 looks — 自動価格反映</div></div>
                   <div className="flex gap-2">
                     {([1,2] as const).map(n => (
                       <button key={n} onClick={() => setAmoreAddons(p => ({...p, makeupLooks: n}))}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${amoreAddons.makeupLooks===n ? 'bg-amore-500 text-white shadow-sm' : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                         {n} look{n===2?'s':''}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Makeup rehearsal */}
                 <div className="flex items-center justify-between py-4">
                   <div><div className="text-sm font-medium text-gray-800">ヘアメイク リハーサル</div><div className="text-[10px] text-gray-400">リハーサルあり → 価格レンジが上がります</div></div>
                   <div className="flex gap-2">
                     {([true,false] as const).map(v => (
                       <button key={String(v)} onClick={() => setAmoreAddons(p => ({...p, makeupRehearsal: v}))}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${amoreAddons.makeupRehearsal===v ? (v?'bg-amore-500 text-white shadow-sm':'bg-gray-300 text-gray-700') : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                         {v?'あり':'なし'}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Real bouquet */}
                 <div className="flex items-center justify-between py-4">
                   <div><div className="text-sm font-medium text-gray-800">生花ブーケ</div><div className="text-[10px] text-gray-400">¥{AMORE_ADDON_CONFIG.realBouquet.min.toLocaleString()}–¥{AMORE_ADDON_CONFIG.realBouquet.max.toLocaleString()}</div></div>
                   <div className="flex gap-2">
                     {([true,false] as const).map(v => (
                       <button key={String(v)} onClick={() => setAmoreAddons(p => ({...p, realBouquet: v}))}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${amoreAddons.realBouquet===v ? (v?'bg-amore-500 text-white shadow-sm':'bg-gray-300 text-gray-700') : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                         {v?'あり':'なし'}
                       </button>
                     ))}
                   </div>
                 </div>
                 {amoreAddons.realBouquet && (
                   <div className="pb-4 pt-1 space-y-2 animate-in zoom-in-95">
                     <div className="flex justify-between text-xs"><span className="text-gray-500">生花ブーケ</span><span className="font-mono font-bold text-amore-600">¥{addonPrices.realBouquet.toLocaleString()}</span></div>
                     <input type="range" min={AMORE_ADDON_CONFIG.realBouquet.min} max={AMORE_ADDON_CONFIG.realBouquet.max} step={1000} value={addonPrices.realBouquet}
                       onChange={e => setAddonPrices(p => ({...p, realBouquet: Number(e.target.value)}))}
                       className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amore-500" />
                   </div>
                 )}

                 {/* Guest table flowers */}
                 <div className="flex items-center justify-between py-4">
                   <div><div className="text-sm font-medium text-gray-800">ゲストテーブル装花</div><div className="text-[10px] text-gray-400">¥{AMORE_ADDON_CONFIG.guestFlowerPerTable.toLocaleString()} / 卓 · {Math.ceil(venueInfo.guestCount/10)}卓</div></div>
                   <div className="flex gap-2">
                     {([true,false] as const).map(v => (
                       <button key={String(v)} onClick={() => setAmoreAddons(p => ({...p, guestFlowers: v}))}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${amoreAddons.guestFlowers===v ? (v?'bg-amore-500 text-white shadow-sm':'bg-gray-300 text-gray-700') : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                         {v?'あり':'なし'}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Placing cards */}
                 <div className="flex items-center justify-between py-4">
                   <div><div className="text-sm font-medium text-gray-800">席札・メニューカード</div><div className="text-[10px] text-gray-400">¥{AMORE_ADDON_CONFIG.placingCardPerPerson} / 人</div></div>
                   <div className="flex gap-2">
                     {([true,false] as const).map(v => (
                       <button key={String(v)} onClick={() => setAmoreAddons(p => ({...p, placingCards: v}))}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${amoreAddons.placingCards===v ? (v?'bg-amore-500 text-white shadow-sm':'bg-gray-300 text-gray-700') : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                         {v?'あり':'なし'}
                       </button>
                     ))}
                   </div>
                 </div>

                 {/* Photo upgrade */}
                 <div className="flex items-center justify-between py-4">
                   <div><div className="text-sm font-medium text-gray-800">フォトサイズアップグレード</div><div className="text-[10px] text-gray-400">+¥{AMORE_ADDON_CONFIG.photoUpgrade.min.toLocaleString()}–¥{AMORE_ADDON_CONFIG.photoUpgrade.max.toLocaleString()}</div></div>
                   <div className="flex gap-2">
                     {([true,false] as const).map(v => (
                       <button key={String(v)} onClick={() => setAmoreAddons(p => ({...p, photoUpgrade: v}))}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${amoreAddons.photoUpgrade===v ? (v?'bg-amore-500 text-white shadow-sm':'bg-gray-300 text-gray-700') : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                         {v?'あり':'なし'}
                       </button>
                     ))}
                   </div>
                 </div>
                 {amoreAddons.photoUpgrade && (
                   <div className="pb-4 pt-1 space-y-2 animate-in zoom-in-95">
                     <div className="flex justify-between text-xs"><span className="text-gray-500">アップグレード料金</span><span className="font-mono font-bold text-amore-600">+¥{addonPrices.photoUpgrade.toLocaleString()}</span></div>
                     <input type="range" min={AMORE_ADDON_CONFIG.photoUpgrade.min} max={AMORE_ADDON_CONFIG.photoUpgrade.max} step={1000} value={addonPrices.photoUpgrade}
                       onChange={e => setAddonPrices(p => ({...p, photoUpgrade: Number(e.target.value)}))}
                       className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amore-500" />
                   </div>
                 )}

                 {/* Aisle flower */}
                 <div className="flex items-center justify-between py-4">
                   <div><div className="text-sm font-medium text-gray-800">アイル装花</div><div className="text-[10px] text-gray-400">¥{AMORE_ADDON_CONFIG.aisleFlower.min.toLocaleString()}–¥{AMORE_ADDON_CONFIG.aisleFlower.max.toLocaleString()}</div></div>
                   <div className="flex gap-2">
                     {([true,false] as const).map(v => (
                       <button key={String(v)} onClick={() => setAmoreAddons(p => ({...p, aisleFlower: v}))}
                         className={`px-4 py-2 rounded-xl text-xs font-bold transition-all ${amoreAddons.aisleFlower===v ? (v?'bg-amore-500 text-white shadow-sm':'bg-gray-300 text-gray-700') : 'bg-gray-100 text-gray-500 hover:bg-gray-200'}`}>
                         {v?'あり':'なし'}
                       </button>
                     ))}
                   </div>
                 </div>
                 {amoreAddons.aisleFlower && (
                   <div className="pb-4 pt-1 space-y-2 animate-in zoom-in-95">
                     <div className="flex justify-between text-xs"><span className="text-gray-500">アイル装花</span><span className="font-mono font-bold text-amore-600">¥{addonPrices.aisleFlower.toLocaleString()}</span></div>
                     <input type="range" min={AMORE_ADDON_CONFIG.aisleFlower.min} max={AMORE_ADDON_CONFIG.aisleFlower.max} step={1000} value={addonPrices.aisleFlower}
                       onChange={e => setAddonPrices(p => ({...p, aisleFlower: Number(e.target.value)}))}
                       className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amore-500" />
                   </div>
                 )}
               </div>

               {/* Auto-configured service cards */}
               {amoreServices.filter(s => s.isSelected).length > 0 && (
                 <div className="space-y-4">
                   <h3 className="text-xs font-black text-gray-400 uppercase tracking-widest">選択内容に基づく自動設定価格 — Fine-tune if needed</h3>
                   <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
                     {amoreServices.filter(s => s.isSelected).map(service => {

                       const isPerTable = service.id === 'amore_guest_fl';
                       const localizedName = getServiceName(service.id);
                       const qty = service.quantity || 1;
                       const effectivePrice = getEffectivePrice(service);
                       const addonAmt = effectivePrice - service.currentPrice;
                       const optionNote = getAmoreOptionText(service);
                       return (
                         <div key={service.id} className="bg-white rounded-[2rem] border-2 border-amore-100 shadow-sm p-5 space-y-3">
                           <div className="flex justify-between items-start">
                             <h4 className="font-serif text-sm font-bold text-gray-900 leading-tight flex-1 pr-2">{localizedName}</h4>
                             <span className="text-[9px] bg-amore-100 text-amore-600 rounded-full px-2 py-0.5 font-black uppercase shrink-0">自動設定</span>
                           </div>
                           {optionNote && (
                             <p className="text-[10px] text-amore-600 italic">{optionNote}</p>
                           )}
                           <div className="bg-gray-50 rounded-xl p-3 space-y-3">
                             <div className="flex justify-between items-center text-xs">
                               <span className="text-gray-500">基本価格</span>
                               <div className="text-right">
                                 <span className="font-mono font-bold text-gray-700">¥{service.currentPrice.toLocaleString()}{isPerTable ? ` × ${qty}卓` : ''}</span>
                                 {addonAmt > 0 && (
                                   <span className="ml-1.5 text-[10px] bg-amore-100 text-amore-600 font-bold px-1.5 py-0.5 rounded-full">+¥{addonAmt.toLocaleString()}</span>
                                 )}
                               </div>
                             </div>
                             <input type="range" min={service.minPrice} max={service.maxPrice}
                               step={service.id === 'amore_guest_fl' ? 500 : 5000}
                               value={service.currentPrice} onChange={e => updateAmorePrice(service.id, Number(e.target.value))}
                               className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amore-500" />
                             <div className="flex justify-between text-[9px] text-gray-400 font-mono">
                               <span>¥{(service.minPrice + addonAmt).toLocaleString()}</span>
                               <span>¥{(service.maxPrice + addonAmt).toLocaleString()}</span>
                             </div>
                           </div>
                           <div className="flex justify-between items-center border-t border-gray-100 pt-2">
                             <span className="text-[10px] text-gray-400 uppercase font-bold tracking-wide">小計</span>
                             <span className="font-mono font-bold text-sm text-amore-700">¥{(effectivePrice * qty).toLocaleString()}</span>
                           </div>
                         </div>
                       );
                     })}
                   </div>
                   {/* Excluded services list */}
                   {amoreServices.some(s => !s.isSelected) && (
                     <div className="flex items-start gap-2 flex-wrap pt-2 border-t border-gray-100">
                       <span className="text-[10px] text-gray-400 font-bold uppercase tracking-wide shrink-0 mt-0.5">除外 / Not included:</span>
                       {amoreServices.filter(s => !s.isSelected).map(s => (
                         <span key={s.id} className="text-[10px] bg-gray-100 text-gray-400 rounded-full px-2 py-0.5 line-through">{getServiceName(s.id)}</span>
                       ))}
                     </div>
                   )}
                 </div>
               )}
             </div>
           )}

           <div className="flex justify-center pt-8">
             <button onClick={() => setActiveTab('preview')} className="bg-amore-600 text-white px-12 sm:px-16 py-5 sm:py-6 rounded-3xl font-serif text-xl sm:text-2xl font-bold flex items-center gap-4 hover:bg-amore-700 hover:scale-105 transition-all shadow-2xl shadow-amore-200 group">
               {t.generateSummary} <ChevronRight className="group-hover:translate-x-2 transition-transform" />
             </button>
           </div>

           {/* 品目マスタ Price Settings Modal — admin only */}
           {isAdmin && showPriceSettings && (
             <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm flex items-center justify-center p-4" onClick={() => setShowPriceSettings(false)}>
               <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={e => e.stopPropagation()}>
                 <div className="p-6 sm:p-8 space-y-6">
                   <div className="flex items-center justify-between">
                     <div>
                       <h3 className="font-serif text-xl font-bold text-gray-900 flex items-center gap-2"><Settings size={18} className="text-amore-500" />品目マスタ 価格設定</h3>
                       <p className="text-xs text-gray-400 mt-1">Amore社内価格表に基づく基準価格を管理します。</p>
                     </div>
                     <button onClick={() => setShowPriceSettings(false)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
                   </div>
                   <button onClick={resetToHinmokuPrices} className="w-full py-3 rounded-xl bg-amore-50 border border-amore-200 text-amore-700 font-bold text-sm hover:bg-amore-100 transition-colors flex items-center justify-center gap-2">
                     <Check size={16} /> 品目マスタの価格にリセット
                   </button>
                   <div className="space-y-3">
                     {amoreServices.map(service => {
                       const orig = INITIAL_SERVICES.find(s => s.id === service.id);
                       const masterPrice = HINMOKU_MASTER_PRICES[service.id];
                       const jaName = AMORE_TEMPLATE_NAMES[service.id] || orig?.name.ja || service.name;
                       return (
                         <div key={service.id} className="flex items-center gap-3 p-4 rounded-2xl bg-gray-50 border border-gray-100">
                           <div className="flex-1 min-w-0">
                             <div className="font-medium text-sm text-gray-800 truncate">{jaName}</div>
                             {masterPrice !== undefined && (
                               <div className="text-[10px] text-amore-500 font-bold mt-0.5 flex items-center gap-1">
                                 <Star size={9} className="fill-amore-400 text-amore-400" />品目マスタ: ¥{masterPrice.toLocaleString()}
                               </div>
                             )}
                           </div>
                           <div className="flex items-center gap-2">
                             <span className="text-xs text-gray-400">¥</span>
                             <input type="number" value={service.currentPrice} onChange={e => updateAmorePrice(service.id, Number(e.target.value))}
                               className="w-28 text-right text-sm font-mono font-bold border border-gray-200 rounded-xl px-3 py-2 focus:outline-none focus:border-amore-400 bg-white" />
                             {masterPrice !== undefined && service.currentPrice !== masterPrice && (
                               <button onClick={() => updateAmorePrice(service.id, masterPrice)}
                                 className="p-1.5 rounded-lg bg-amore-50 hover:bg-amore-100 text-amore-500 transition-colors" title="品目マスタにリセット">
                                 <Check size={13} />
                               </button>
                             )}
                           </div>
                         </div>
                       );
                     })}
                   </div>
                 </div>
               </div>
             </div>
           )}
        </div>
        <div className={activeTab === 'preview' ? 'block animate-in fade-in' : 'hidden'}>
           <div id="quote-content" className="bg-white p-6 sm:p-12 rounded-[3rem] shadow-2xl max-w-[900px] mx-auto border border-gray-100">
              <section className="text-center border-b-2 border-gray-50 pb-8 sm:pb-12 mb-8 sm:mb-12 space-y-8">
                 <div className="flex justify-center">
                    <div className="w-16 h-16 bg-amore-50 rounded-2xl flex items-center justify-center">
                       <Heart className="text-amore-500 fill-amore-500" size={32} />
                    </div>
                 </div>
                 <div className="space-y-2">
                    <h1 className="text-4xl sm:text-5xl font-serif font-bold text-gray-900">{t.title}</h1>
                    <p className="text-gray-400 tracking-widest uppercase text-[10px] font-black">{t.guestCount}: {venueInfo.guestCount} Guests • {t.date}: {todayDate}</p>
                    {venueInfo.name && <p className="text-amore-600 font-serif text-lg italic mt-2">Venue: {venueInfo.name}</p>}
                 </div>

                 {/* Simulation banner */}
                 <div className="mx-auto max-w-2xl bg-amber-50 border border-amber-200 rounded-2xl px-5 py-3 flex items-start gap-3">
                   <span className="text-amber-500 text-lg shrink-0">⚠</span>
                   <div className="text-left space-y-1">
                     <p className="text-[11px] font-black text-amber-700 uppercase tracking-wide">参考シミュレーション / Budget Simulation Only</p>
                     <p className="text-xs text-amber-700/80 leading-relaxed">{t.disclaimer}</p>
                   </div>
                 </div>

                 <div className="bg-rose-50/50 border border-rose-100 p-6 rounded-3xl mx-auto max-w-2xl">
                    <p className="text-amore-700 text-sm italic leading-relaxed">
                       {t.appIntro}
                    </p>
                 </div>
              </section>

              <div className="space-y-12 mb-20 px-4 sm:px-8">

                 {/* ── Venue Section ── */}
                 <div className="break-inside-avoid group">
                   <div className="flex items-center gap-4 mb-6">
                     <div className="h-px flex-1 bg-gray-100 group-hover:bg-amore-200 transition-colors"></div>
                     <h3 className="text-[10px] font-black text-gray-300 group-hover:text-amore-400 uppercase tracking-[0.3em] transition-colors">会場費用 / Venue</h3>
                     <div className="h-px flex-1 bg-gray-100 group-hover:bg-amore-200 transition-colors"></div>
                   </div>
                   <div className="space-y-5">
                     {VENUE_MANDATORY_ITEMS.map(item => {
                       const price = mandatoryPrices[item.id] ?? item.defaultPrice;
                       return (
                         <div key={item.id} className="flex justify-between items-baseline">
                           <span className="font-serif text-lg sm:text-xl text-gray-800">{item.ja}</span>
                           <span className="font-mono font-bold text-base sm:text-lg">¥{price.toLocaleString()}</span>
                         </div>
                       );
                     })}
                     <div className="flex justify-between items-baseline">
                       <div className="flex flex-col">
                         <span className="font-serif text-lg sm:text-xl text-gray-800">お食事（{FOOD_PLANS[foodPlan].ja}）</span>
                         <span className="text-[10px] text-gray-400 font-mono mt-1">¥{foodPricePerPerson.toLocaleString()} × {venueInfo.guestCount}名</span>
                       </div>
                       <span className="font-mono font-bold text-base sm:text-lg">¥{venueFoodTotal.toLocaleString()}</span>
                     </div>
                     {drinksIncluded && (
                       <div className="flex justify-between items-baseline">
                         <div className="flex flex-col">
                           <span className="font-serif text-lg sm:text-xl text-gray-800">ドリンク</span>
                           <span className="text-[10px] text-gray-400 font-mono mt-1">¥{drinkPricePerPerson.toLocaleString()} × {venueInfo.guestCount}名</span>
                         </div>
                         <span className="font-mono font-bold text-base sm:text-lg">¥{venueDrinkTotal.toLocaleString()}</span>
                       </div>
                     )}
                     {childCount > 0 && (
                       <div className="flex justify-between items-baseline">
                         <div className="flex flex-col">
                           <span className="font-serif text-lg sm:text-xl text-gray-800">お子様料金</span>
                           <span className="text-[10px] text-gray-400 font-mono mt-1">¥{CHILD_PRICE.toLocaleString()} × {childCount}名</span>
                         </div>
                         <span className="font-mono font-bold text-base sm:text-lg">¥{venueChildTotal.toLocaleString()}</span>
                       </div>
                     )}
                     {Object.entries(selectedOptionals).map(([optId, price]: [string, number]) => {
                       const optItem = VENUE_OPTIONAL_ITEMS.find(i => i.id === optId);
                       if (!optItem) return null;
                       const total = optItem.isPerGuest ? price * venueInfo.guestCount : price;
                       return (
                         <div key={optId} className="flex justify-between items-baseline">
                           <div className="flex flex-col">
                             <span className="font-serif text-lg sm:text-xl text-gray-800">{optItem.ja}</span>
                             {optItem.isPerGuest && <span className="text-[10px] text-gray-400 font-mono mt-1">¥{price.toLocaleString()} × {venueInfo.guestCount}名</span>}
                           </div>
                           <span className="font-mono font-bold text-base sm:text-lg">¥{total.toLocaleString()}</span>
                         </div>
                       );
                     })}
                     <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                       <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">会場小計</span>
                       <span className="font-mono font-bold text-base sm:text-lg text-gray-700">¥{venueSubtotal.toLocaleString()}</span>
                     </div>
                   </div>
                 </div>

                 {/* ── Amore Section ── */}
                 {amoreMode && (
                   <div className="break-inside-avoid group">
                     <div className="flex items-center gap-4 mb-6">
                       <div className="h-px flex-1 bg-gray-100 group-hover:bg-amore-200 transition-colors"></div>
                       <h3 className="text-[10px] font-black text-gray-300 group-hover:text-amore-400 uppercase tracking-[0.3em] transition-colors">Amoreサービス</h3>
                       <div className="h-px flex-1 bg-gray-100 group-hover:bg-amore-200 transition-colors"></div>
                     </div>
                     <div className="space-y-5">
                       {amoreMode === 'standard' ? (
                         <div className="space-y-4">
                           <div className="flex justify-between items-baseline text-amore-700 bg-amore-50/30 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 rounded-3xl border border-amore-50">
                             <div className="flex flex-col">
                               <span className="font-serif text-lg sm:text-xl font-bold">スタンダードパッケージ</span>
                               <span className="text-[10px] text-amore-400 font-mono mt-1">税込 ¥407,000</span>
                             </div>
                             <span className="font-mono font-bold text-lg sm:text-xl">¥{AMORE_STANDARD_PRETAX.toLocaleString()}</span>
                           </div>
                           <div className="pl-4 border-l-2 border-amore-100 flex flex-wrap gap-1.5">
                             {AMORE_STANDARD_INCLUDES.map(inc => (
                               <span key={inc.ja} className="text-[10px] bg-amore-50 border border-amore-100 text-amore-600 rounded-full px-2 py-0.5">{inc.ja}</span>
                             ))}
                           </div>
                         </div>
                       ) : (
                         <>
                           {selectedAmoreServices.map(item => {
                             const isPerTable = item.id === 'amore_guest_fl';
                             const qty = item.quantity || 1;
                             const totalItemPrice = item.currentPrice * qty;
                             return (
                               <div key={item.id} className="flex justify-between items-baseline text-amore-700 bg-amore-50/30 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 rounded-3xl border border-amore-50">
                                 <div className="flex flex-col">
                                   <span className="font-serif text-lg sm:text-xl font-bold">{getServiceName(item.id)}</span>
                                   {isPerTable && <span className="text-[10px] text-amore-400 font-mono mt-1">¥{item.currentPrice.toLocaleString()} × {qty}卓</span>}
                                 </div>
                                 <span className="font-mono font-bold text-lg sm:text-xl">¥{totalItemPrice.toLocaleString()}</span>
                               </div>
                             );
                           })}
                           {amoreAddons.aisleFlower && (
                             <div className="flex justify-between items-baseline text-amore-700 bg-amore-50/30 px-4 sm:px-6 py-4 -mx-4 sm:-mx-6 rounded-3xl border border-amore-50">
                               <span className="font-serif text-lg sm:text-xl font-bold">アイル装花</span>
                               <span className="font-mono font-bold text-lg sm:text-xl">¥{addonPrices.aisleFlower.toLocaleString()}</span>
                             </div>
                           )}
                         </>
                       )}
                       <div className="flex justify-between items-center border-t border-gray-100 pt-4">
                         <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Amore小計</span>
                         <span className="font-mono font-bold text-base sm:text-lg text-amore-700">¥{amoreSubtotal.toLocaleString()}</span>
                       </div>
                     </div>
                   </div>
                 )}

              </div>

              <div className="mb-12 px-4 sm:px-8">
                 <div className="bg-amber-50 border border-amber-100 p-6 sm:p-8 rounded-[2.5rem] flex items-start gap-5 shadow-sm">
                    <div className="w-12 h-12 bg-white rounded-2xl flex items-center justify-center shadow-sm shrink-0">
                       <MessageCircle className="text-amber-500" size={24} />
                    </div>
                    <div className="space-y-2">
                       <h4 className="font-bold text-amber-800 text-base sm:text-lg">Budget Friendly Planning</h4>
                       <p className="text-amber-700/80 text-sm leading-relaxed italic">{t.budgetFriendlyNote}</p>
                    </div>
                 </div>
              </div>

              <section className="bg-gray-900 text-white rounded-[2rem] sm:rounded-[4rem] p-8 sm:p-16 shadow-2xl relative overflow-hidden">
                 <div className="absolute top-0 right-0 w-64 h-64 bg-amore-500/10 rounded-full -mr-32 -mt-32 blur-3xl"></div>
                 <div className="grid grid-cols-1 md:grid-cols-2 gap-8 md:gap-16 relative z-10">
                    <div className="space-y-6">
                       <h3 className="text-4xl md:text-5xl font-serif font-bold text-amore-400 leading-tight">{t.totalEstimate}</h3>
                       <p className="text-gray-400 text-xs leading-relaxed max-w-xs">{t.disclaimer}</p>
                    </div>
                    <div className="text-right space-y-8 self-end">
                       <div className="text-gray-400 space-y-3">
                          <div className="flex justify-between items-center border-b border-gray-800 pb-3"> 
                            <span className="text-[10px] uppercase tracking-widest font-bold">{t.subtotal}</span> 
                            <span className="text-white font-mono text-lg sm:text-xl font-bold">¥{subtotalBeforeTax.toLocaleString()}</span> 
                          </div>
                          <div className="flex justify-between items-center"> 
                            <span className="text-[10px] uppercase tracking-widest font-bold">{t.tax}</span> 
                            <span className="text-white font-mono text-lg sm:text-xl font-bold">¥{taxAmount.toLocaleString()}</span> 
                          </div>
                       </div>
                       <div className="text-5xl sm:text-6xl md:text-7xl font-serif font-bold text-white tracking-tighter shadow-amore-500/20 drop-shadow-2xl">¥{Math.floor(grandTotal).toLocaleString()}</div>
                    </div>
                 </div>
              </section>

              {/* Branding and timestamp footer for the download */}
              <div className="mt-12 pt-8 border-t border-gray-50 flex flex-col sm:flex-row justify-between items-center gap-4 text-gray-400 text-[10px] font-bold uppercase tracking-widest italic">
                  <div className="flex items-center gap-2">
                    <Heart size={12} className="text-amore-500 fill-amore-500" />
                    <span>{t.amoreTokyo}</span>
                  </div>
                  {downloadTime && (
                    <div className="flex items-center gap-2">
                      <Clock size={12} />
                      <span>{t.generatedOn}: {downloadTime}</span>
                    </div>
                  )}
              </div>
           </div>
        </div>
      </main>

      <div className="fixed bottom-0 left-0 w-full z-50 no-print">
        <div className="max-w-7xl mx-auto px-2 sm:px-0">
            <div className="bg-white/95 backdrop-blur-xl border-t border-x border-gray-100 rounded-t-3xl shadow-[0_-20px_50px_rgba(0,0,0,0.08)] p-2 sm:p-3 flex flex-col gap-2">
                <div className="grid grid-cols-1 sm:grid-cols-5 items-center gap-3 sm:gap-4">
                    <div className="col-span-1 hidden sm:flex items-center gap-2 text-gray-500">
                        <Users size={20} />
                        <span className="text-sm font-bold uppercase tracking-wider">{t.guestCount}</span>
                    </div>
                    <div className="col-span-1 sm:hidden flex justify-between items-center">
                        <span className="text-xs font-bold uppercase tracking-wider text-gray-500">{t.guestCount}</span>
                        <span className="text-xl font-serif font-bold text-amore-600">{venueInfo.guestCount}</span>
                    </div>
                    <div className="sm:col-span-3 flex-1 flex items-center gap-4">
                        <button onClick={() => setVenueInfo(p => ({...p, guestCount: Math.max(10, p.guestCount - 1)}))} className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"><Minus size={16} /></button>
                        <input 
                          type="range"
                          min="10"
                          max="200"
                          value={venueInfo.guestCount}
                          onChange={(e) => setVenueInfo(p => ({ ...p, guestCount: Number(e.target.value) }))}
                          className="w-full h-2 bg-gray-200 rounded-lg appearance-none cursor-pointer accent-amore-500"
                        />
                        <button onClick={() => setVenueInfo(p => ({...p, guestCount: Math.min(200, p.guestCount + 1)}))} className="p-1.5 rounded-full bg-gray-100 hover:bg-gray-200 transition-colors"><Plus size={16} /></button>
                    </div>
                    <div className="col-span-1 text-right hidden sm:block">
                        <span className="text-2xl font-serif font-bold text-amore-600">{venueInfo.guestCount}</span>
                    </div>
                </div>

                <div className="border-b border-gray-100 !my-2"></div>

                <div className="flex flex-col md:flex-row justify-between items-center gap-3">
                   <div className="flex items-center gap-4 sm:gap-8 w-full md:w-auto">
                      <div className="shrink-0">
                         <span className="text-[10px] text-gray-400 font-black uppercase tracking-[0.2em] mb-1 block">{t.estimateTotal}</span>
                         <div className={`text-2xl sm:text-3xl font-serif font-bold ${isOverBudget ? 'text-red-500' : 'text-amore-600'}`}>¥{Math.floor(grandTotal).toLocaleString()}</div>
                      </div>
                      <div className="hidden lg:block flex-1 min-w-[300px]">
                         <div className="flex justify-between text-[10px] font-black mb-2 uppercase tracking-widest">
                            <span className="text-gray-400">{t.budgetStatus}</span>
                            <span className={isOverBudget ? 'text-red-500' : 'text-amore-500'}>{budgetUsage.toFixed(0)}% used</span>
                         </div>
                         <div className="h-3 w-full bg-gray-100 rounded-full overflow-hidden">
                            <div className={`h-full transition-all duration-700 cubic-bezier(0.4, 0, 0.2, 1) ${isOverBudget ? 'bg-red-500' : 'bg-amore-500 shadow-[0_0_15px_rgba(244,63,94,0.4)]'}`} style={{ width: `${Math.min(budgetUsage, 100)}%` }}></div>
                         </div>
                      </div>
                   </div>
                   <div className="flex gap-2 sm:gap-4 w-full md:w-auto">
                      <button 
                        onClick={() => setActiveTab('preview')} 
                        className={`flex-1 md:flex-none px-4 sm:px-6 py-2 sm:py-3 rounded-xl font-bold text-sm transition-all ${activeTab === 'preview' ? 'bg-amore-600 text-white shadow-xl scale-105' : 'bg-white border border-gray-200 text-gray-700 hover:border-amore-300'}`}
                      > 
                        {t.viewDocument} 
                      </button>
                      <button
                        onClick={() => setShowTemplateModal(true)}
                        className="bg-amore-600 text-white px-4 sm:px-5 py-2 sm:py-3 rounded-xl hover:bg-amore-700 transition-all flex items-center justify-center gap-2 shadow-lg text-xs font-bold"
                      >
                        <FileText size={15} />
                        <span className="hidden sm:inline">シミュレーション</span>
                      </button>
                      <button onClick={handleDownloadImage} disabled={capturing} className="bg-gray-900 text-white px-5 sm:px-6 py-2 sm:py-3 rounded-xl hover:bg-black transition-all flex items-center justify-center shadow-lg hover:shadow-xl disabled:opacity-50">
                        {capturing ? <Loader2 className="animate-spin" /> : <Download size={16} />}
                      </button>
                   </div>
                </div>
            </div>
        </div>
      </div>
      {/* 見積もり Template Modal */}
      {showTemplateModal && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-start justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-[2rem] shadow-2xl w-full max-w-3xl my-8">
            <div className="flex items-center justify-between p-6 border-b border-gray-100">
              <h3 className="font-serif text-xl font-bold text-gray-900">費用シミュレーション プレビュー</h3>
              <div className="flex items-center gap-3">
                <button
                  onClick={handleDownloadTemplate}
                  disabled={downloadingTemplate}
                  className="flex items-center gap-2 bg-amore-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-amore-700 transition-colors disabled:opacity-50"
                >
                  {downloadingTemplate ? <Loader2 size={16} className="animate-spin" /> : <Download size={16} />}
                  ダウンロード
                </button>
                <button onClick={() => setShowTemplateModal(false)} className="p-2 rounded-full hover:bg-gray-100 text-gray-400"><X size={18} /></button>
              </div>
            </div>

            {/* Template content captured by html2canvas */}
            <div id="template-quote-content" className="p-8 sm:p-12 bg-white font-sans" style={{ fontFamily: "'Noto Sans JP', sans-serif" }}>
              {/* Header */}
              {/* Simulation banner */}
              <div className="mb-6 px-4 py-2 bg-amber-50 border border-amber-200 rounded text-center">
                <span className="text-[10px] font-bold text-amber-700 uppercase tracking-widest">⚠ 本書は費用シミュレーション（参考試算）です。正式な見積書・契約書ではありません。</span>
              </div>

              <div className="flex justify-between items-start mb-8">
                <div className="space-y-3">
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">お客様名 / Client Name</div>
                    <div className="text-sm border-b-2 border-gray-400 pb-0.5 w-52 text-gray-300 italic">（ここにご記入ください）</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">結婚式日程 / Wedding Date</div>
                    <div className="text-sm border-b-2 border-gray-400 pb-0.5 w-52 text-gray-300 italic">（ここにご記入ください）</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">ご希望会場 / Venue</div>
                    <div className="text-sm border-b-2 border-gray-400 pb-0.5 w-52 text-gray-300 italic">（ここにご記入ください）</div>
                  </div>
                  <div>
                    <div className="text-[10px] text-gray-400 uppercase tracking-widest mb-0.5">お招待人数 / Guest Count</div>
                    <div className="text-sm border-b border-gray-300 pb-0.5 w-52 font-medium text-gray-700">{venueInfo.guestCount}名</div>
                  </div>
                </div>
                <div className="text-right space-y-1">
                  <div className="text-2xl font-bold text-gray-900" style={{ fontFamily: "serif" }}>費用シミュレーション</div>
                  <div className="text-xs text-gray-400">（参考試算 · 正式見積書ではありません）</div>
                  <div className="text-xs text-gray-500 mt-3">{new Date().toLocaleDateString('ja-JP', { year: 'numeric', month: 'long', day: 'numeric' })}</div>
                  <div className="text-xs text-gray-500">StartUP株式会社</div>
                  <div className="text-xs text-gray-400">東京都文京区千石４丁目26-2</div>
                  <div className="text-xs text-gray-400">ＳＡＮＳＡＮ千石第一ビル 301</div>
                  <div className="text-xs text-gray-400">TEL：080-3516-7231</div>
                </div>
              </div>

              <div className="text-sm text-gray-600 mb-6 border-b border-gray-200 pb-4">下記のとおりシミュレーション金額をご案内いたします。<span className="text-xs text-gray-400 ml-2">（実際の金額は担当プランナーより確認のうえご案内いたします）</span></div>

              {/* Total amount box */}
              <div className="flex justify-between items-center mb-6 p-4 border-2 border-gray-900">
                <div className="text-sm font-bold text-gray-700">シミュレーション金額<span className="text-[10px] font-normal text-gray-400 ml-1">（参考）</span></div>
                <div className="text-2xl font-bold text-gray-900">¥{Math.floor(grandTotal).toLocaleString()} -</div>
                <div className="text-xs text-gray-500">
                  <div>小計: ¥{subtotalBeforeTax.toLocaleString()}</div>
                  <div>消費税(10%): ¥{taxAmount.toLocaleString()}</div>
                </div>
              </div>

              {/* Line items table */}
              <table className="w-full text-xs border-collapse mb-8">
                <thead>
                  <tr className="bg-gray-800 text-white">
                    <th className="border border-gray-600 px-2 py-2 text-center w-8">No.</th>
                    <th className="border border-gray-600 px-3 py-2 text-left">品番・品名</th>
                    <th className="border border-gray-600 px-2 py-2 text-center w-12">数量</th>
                    <th className="border border-gray-600 px-2 py-2 text-center w-10">単位</th>
                    <th className="border border-gray-600 px-2 py-2 text-right w-24">単価</th>
                    <th className="border border-gray-600 px-2 py-2 text-right w-24">金額</th>
                    <th className="border border-gray-600 px-2 py-2 text-center w-10">税</th>
                  </tr>
                </thead>
                <tbody>
                  {(() => {
                    const rows: React.ReactNode[] = [];
                    let no = 1;
                    // Venue line items
                    const venueLineItems = [
                      ...VENUE_MANDATORY_ITEMS.map(item => ({
                        id: item.id, name: item.ja, qty: 1, unit: item.unit,
                        unitPrice: mandatoryPrices[item.id] ?? item.defaultPrice
                      })),
                      { id: 'venue_food', name: `お食事（${FOOD_PLANS[foodPlan].ja}）`, qty: venueInfo.guestCount, unit: '人', unitPrice: foodPricePerPerson },
                      ...(drinksIncluded ? [{ id: 'venue_drink', name: 'ドリンク', qty: venueInfo.guestCount, unit: '人', unitPrice: drinkPricePerPerson }] : []),
                      ...(childCount > 0 ? [{ id: 'venue_child', name: 'お子様料金', qty: childCount, unit: '人', unitPrice: CHILD_PRICE }] : []),
                      ...Object.entries(selectedOptionals).map(([optId, price]) => {
                        const optItem = VENUE_OPTIONAL_ITEMS.find(i => i.id === optId)!;
                        return { id: optId, name: optItem.ja, qty: optItem.isPerGuest ? venueInfo.guestCount : 1, unit: optItem.unit, unitPrice: price };
                      }),
                    ];
                    venueLineItems.forEach(item => {
                      const total = item.unitPrice * item.qty;
                      rows.push(
                        <tr key={item.id} className="even:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{no++}</td>
                          <td className="border border-gray-300 px-3 py-1.5">{item.name}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{item.qty}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{item.unit}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right font-mono">¥{item.unitPrice.toLocaleString()}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right font-mono font-bold">¥{total.toLocaleString()}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-500">10%</td>
                        </tr>
                      );
                    });
                    // Amore standard as single line
                    if (amoreMode === 'standard') {
                      rows.push(
                        <tr key="amore_std" className="even:bg-gray-50 bg-rose-50/30">
                          <td className="border border-gray-300 px-2 py-1.5 text-center">{no++}</td>
                          <td className="border border-gray-300 px-3 py-1.5 text-amore-700">Amoreスタンダードパッケージ</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">1</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center">式</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right font-mono">¥{AMORE_STANDARD_PRETAX.toLocaleString()}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-right font-mono font-bold">¥{AMORE_STANDARD_PRETAX.toLocaleString()}</td>
                          <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-500">10%</td>
                        </tr>
                      );
                    }
                    if (amoreMode === 'custom') {
                      amoreServices.filter(s => s.isSelected).forEach(service => {
                        const jaName = AMORE_TEMPLATE_NAMES[service.id] || service.name;
                        const qty = service.quantity || 1;
                        const ep = getEffectivePrice(service);
                        const total = ep * qty;
                        rows.push(
                          <tr key={service.id} className="even:bg-gray-50 bg-rose-50/30">
                            <td className="border border-gray-300 px-2 py-1.5 text-center">{no++}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-amore-700">{jaName}</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-center">{qty}</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-center">式</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-right font-mono">¥{ep.toLocaleString()}</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-right font-mono font-bold">¥{total.toLocaleString()}</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-500">10%</td>
                          </tr>
                        );
                      });
                      if (amoreAddons.aisleFlower) {
                        rows.push(
                          <tr key="aisle_fl" className="even:bg-gray-50 bg-rose-50/30">
                            <td className="border border-gray-300 px-2 py-1.5 text-center">{no++}</td>
                            <td className="border border-gray-300 px-3 py-1.5 text-amore-700">アイル装花</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-center">1</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-center">式</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-right font-mono">¥{addonPrices.aisleFlower.toLocaleString()}</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-right font-mono font-bold">¥{addonPrices.aisleFlower.toLocaleString()}</td>
                            <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-500">10%</td>
                          </tr>
                        );
                      }
                    }
                    // Empty rows to pad to at least 10 lines
                    while (rows.length < 10) {
                      rows.push(
                        <tr key={`empty-${rows.length}`} className="even:bg-gray-50">
                          <td className="border border-gray-300 px-2 py-1.5 text-center text-gray-300">{no++}</td>
                          <td className="border border-gray-300 px-3 py-1.5">&nbsp;</td>
                          <td className="border border-gray-300 px-2 py-1.5"></td>
                          <td className="border border-gray-300 px-2 py-1.5"></td>
                          <td className="border border-gray-300 px-2 py-1.5"></td>
                          <td className="border border-gray-300 px-2 py-1.5"></td>
                          <td className="border border-gray-300 px-2 py-1.5"></td>
                        </tr>
                      );
                    }
                    return rows;
                  })()}
                  {/* Totals */}
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={5} className="border border-gray-300 px-3 py-2 text-right text-xs">小計</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono">¥{subtotalBeforeTax.toLocaleString()}</td>
                    <td className="border border-gray-300"></td>
                  </tr>
                  <tr className="bg-gray-100 font-bold">
                    <td colSpan={5} className="border border-gray-300 px-3 py-2 text-right text-xs">消費税（10%）</td>
                    <td className="border border-gray-300 px-2 py-2 text-right font-mono">¥{taxAmount.toLocaleString()}</td>
                    <td className="border border-gray-300"></td>
                  </tr>
                  <tr className="bg-gray-800 text-white font-bold">
                    <td colSpan={5} className="border border-gray-600 px-3 py-2 text-right text-sm">合　計</td>
                    <td className="border border-gray-600 px-2 py-2 text-right font-mono text-base">¥{Math.floor(grandTotal).toLocaleString()}</td>
                    <td className="border border-gray-600"></td>
                  </tr>
                </tbody>
              </table>

              {/* Footer */}
              <div className="flex justify-between items-end text-xs text-gray-500 border-t border-gray-200 pt-4 mt-4">
                <div className="max-w-xs space-y-1">
                  <div className="text-[9px] font-bold text-amber-600 uppercase tracking-wide">参考試算 / Simulation Only</div>
                  <div className="text-[9px] text-gray-400 italic leading-relaxed">{t.disclaimer}</div>
                  <div className="text-[9px] text-gray-400 italic">本シミュレーションはAmoreスタッフとの打ち合わせのベースとしてお使いください。</div>
                </div>
                <div className="text-right space-y-0.5">
                  <div className="font-bold text-gray-700">StartUP株式会社 / Amore Wedding Tokyo</div>
                  <div>startup.eternalknotweddings@gmail.com</div>
                  <div className="flex items-center justify-end gap-1 text-amore-500 mt-1">
                    <Heart size={10} className="fill-amore-500" /> Amore Wedding Tokyo
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
