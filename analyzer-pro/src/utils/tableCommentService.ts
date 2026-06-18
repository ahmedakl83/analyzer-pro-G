import type { DemographicResult, LikertGroupResult, ResponseItem } from '../types/survey';

/**
 * خدمة مستقلة لإنشاء التعليقات التحليلية على الجداول النهائية
 * تحتوي على منطق التعليق الأساسي (الديموغرافي + ليكرت) والملخص العام.
 */
export class TableCommentService {

  /**
   * تحويل الأرقام الإنجليزية إلى الأرقام العربية الهندية
   */
  static toIndic(input: string | number): string {
    const str = input.toString();
    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];

    let result = str;
    for (let i = 0; i < english.length; i++) {
      result = result.replace(new RegExp(english[i], 'g'), arabic[i]);
    }
    return result;
  }

  /**
   * فحص إذا كانت النسبة تقابل كسراً شهيراً (مع هامش ±1%)
   * يُرجع: { fraction, exact } أو null
   * exact = true  → النسبة مطابقة تماماً
   * exact = false → النسبة تقريبية (ضمن هامش ±1%)
   */
  private static matchFraction(pct: number): { fraction: string; exact: boolean } | null {
    const r = Math.round(pct * 100) / 100;

    // 100%
    if (r === 100) return { fraction: "كافة أفراد عينة البحث", exact: true };

    // ثلاثة أرباع 75%
    if (r === 75)  return { fraction: "ثلاثة أرباع عينة البحث", exact: true };
    if (r >= 74 && r <= 76 && r !== 75) return { fraction: "ثلاثة أرباع عينة البحث", exact: false };

    // ثلثا 66.67%
    if (Math.abs(r - 66.67) < 0.1) return { fraction: "ثلثا عينة البحث", exact: true };
    if (Math.abs(r - 66.67) < 1.1) return { fraction: "ثلثا عينة البحث", exact: false };

    // نصف 50%
    if (r === 50)  return { fraction: "نصف عينة البحث", exact: true };
    if (r >= 49 && r <= 51 && r !== 50) return { fraction: "نصف عينة البحث", exact: false };

    // ثلث 33.33%
    if (Math.abs(r - 33.33) < 0.1) return { fraction: "ثلث عينة البحث", exact: true };
    if (Math.abs(r - 33.33) < 1.1) return { fraction: "ثلث عينة البحث", exact: false };

    // ربع 25%
    if (r === 25)  return { fraction: "ربع عينة البحث", exact: true };
    if (r >= 24 && r <= 26 && r !== 25) return { fraction: "ربع عينة البحث", exact: false };

    return null;
  }

  /**
   * تنسيق نسبة مئوية للجداول الديموغرافية:
   * - إذا طابقت كسراً شهيراً: تُعرض النسبة الصريحة أولاً ثم الكسر
   *   مثال: (50%) وهو ما يشكل نصف عينة البحث
   *   أو:   (49%) وهو ما يشكل تقريباً نصف عينة البحث
   * - إذا لم تطابق: تُعرض النسبة فقط بين قوسين
   */
  private static formatDemoPct(pct: number): string {
    const match = this.matchFraction(pct);
    const numStr = Number.isInteger(pct) ? pct.toString() : pct.toFixed(2).replace(/\.?0+$/, '');
    const numFormatted = `(${this.toIndic(numStr)}%)`;

    if (!match) return numFormatted;

    if (match.fraction === "كافة أفراد عينة البحث") {
      // حالة 100% لا تحتاج تكراراً
      return `(${this.toIndic("100")}%) أي ما يمثل كافة أفراد عينة البحث`;
    }

    const approx = match.exact ? "" : " تقريباً";
    return `${numFormatted} وهو ما يشكل${approx} ${match.fraction}`;
  }

  /**
   * تجميع الفئات المتساوية في النسبة معاً
   */
  private static groupByPercentage(rows: ResponseItem[]): Array<{ percentage: number; items: ResponseItem[] }> {
    const groups: Array<{ percentage: number; items: ResponseItem[] }> = [];
    for (const row of rows) {
      const existing = groups.find(g => Math.abs(g.percentage - row.percentage) < 0.01);
      if (existing) {
        existing.items.push(row);
      } else {
        groups.push({ percentage: row.percentage, items: [row] });
      }
    }
    return groups;
  }

  private static getSemanticConfig(question: string): { basePhrase: string; suffix: string; transformAns: (ans: string) => string } {
    const q = question.replace(/\s*\[.*?\]|\s*\(.*?\)/g, '').trim();
    const defaultTransform = (ans: string) => `(${ans.trim()})`;

    if (q.includes("مكان السكن") || q.includes("الإقامة") || q.includes("السكن")) {
      return {
        basePhrase: "من يعيشون في",
        suffix: "",
        transformAns: (ans) => {
          let a = ans.replace(/[\(\)]/g, '').trim();
          if (!a.startsWith('ال')) a = 'ال' + a;
          return a;
        }
      };
    }

    if (q.includes("النوع") || q.includes("الجنس")) {
      return {
        basePhrase: "", 
        suffix: "",
        transformAns: (ans) => {
          const a = ans.replace(/[\(\)]/g, '').trim();
          if (a === "أنثى") return "إناث";
          if (a === "ذكر") return "ذكور";
          return a;
        }
      };
    }

    if (q.includes("السن") || q.includes("العمر") || q.includes("أعمار")) {
      return {
        basePhrase: "من أعمارهم",
        suffix: " عام",
        transformAns: defaultTransform
      };
    }

    if (q.includes("صف") || q.includes("مرحلة") || q.includes("مستوى دراسي")) {
      return {
        basePhrase: "طلاب",
        suffix: "",
        transformAns: defaultTransform
      };
    }

    if (q.includes("حجم الأسرة") || q.includes("عدد أفراد الأسرة")) {
      return {
        basePhrase: "أفراد عينة البحث الذين ينتمون إلى أسر حجمها",
        suffix: "",
        transformAns: defaultTransform
      };
    }

    if (q.includes("ترتيب")) {
      return {
        basePhrase: "الترتيب بين الأخوة",
        suffix: "",
        transformAns: defaultTransform
      };
    }

    if (q.includes("زواج")) {
      return {
        basePhrase: "من كانت مدة زواج والديهم",
        suffix: "",
        transformAns: defaultTransform
      };
    }

    if (q.includes("مهنة") || q.includes("عمل") || q.includes("وظيفة")) {
      return {
        basePhrase: "أصحاب مهنة",
        suffix: "",
        transformAns: defaultTransform
      };
    }

    if (q.includes("دخل") || q.includes("راتب")) {
      return {
        basePhrase: "أصحاب الدخل الشهري",
        suffix: "",
        transformAns: defaultTransform
      };
    }

    if (q.includes("غياب")) {
      return {
        basePhrase: "من فترات غياب آبائهم",
        suffix: "",
        transformAns: defaultTransform
      };
    }

    if (/^[يتم|يقضون|يلجؤون|يتعرضون|يفضلون|يعتبرون|يحصلون|يستخدمون|يغلب]/.test(q)) {
      return {
        basePhrase: `من ${q}`,
        suffix: "",
        transformAns: defaultTransform
      };
    }

    if (q.split(' ').length > 2) {
      return {
        basePhrase: `من كان ${q}`,
        suffix: "",
        transformAns: defaultTransform
      };
    }

    return {
      basePhrase: "فئة",
      suffix: "",
      transformAns: defaultTransform
    };
  }

  private static applyPreposition(prep: 'لـ ' | 'بين كلٌّ من ' | '', phrase: string): string {
    if (prep === 'لـ ') {
      let p = phrase.trim();
      if (!p) return ''; 
      if (p.startsWith('ال')) return 'لل' + p.substring(2);
      if (p.startsWith('أ')) return 'لأ' + p.substring(1);
      if (p.startsWith('إ')) return 'لإ' + p.substring(1);
      if (p.startsWith('ا')) return 'لا' + p.substring(1);
      if (p.startsWith('من ')) return 'لمن ' + p.substring(3);
      return 'ل' + p; 
    }
    return prep + phrase;
  }

  private static formatSemanticGroup(
    config: { basePhrase: string; suffix: string; transformAns: (ans: string) => string },
    items: ResponseItem[],
    prep: 'لـ ' | 'بين كلٌّ من ' | ''
  ): string {
    const joinedAnswers = items.map(r => config.transformAns(r.answer)).join(" و");
    if (!config.basePhrase) {
       if (prep === 'بين كلٌّ من ') return `${prep}${joinedAnswers}${config.suffix}`;
       return `${joinedAnswers}${config.suffix}`;
    }
    const preppedBase = prep ? this.applyPreposition(prep, config.basePhrase) : config.basePhrase;
    return `${preppedBase} ${joinedAnswers}${config.suffix}`.replace(/\s+/g, ' ').trim();
  }

  /**
   * إنشاء تعليق تحليلي للبيانات الديموغرافية وفق قواعد الصياغة الاحترافية:
   * - الترتيب تنازلياً من الأعلى للأقل
   * - دمج الفئات المتساوية لغوياً
   * - استخدام الكسور الشهيرة (نصف، ثلث، ربع، ثلاثة أرباع، ثلثا)
   * - معالجة الحالات الخاصة: 100%، 50/50، أغلبية كاسحة، تقارب شديد، انعدام
   */
  static generateGeneralComment(questionText: string, sortedRows: ResponseItem[]): string {
    if (sortedRows.length === 0) return "";

    // استبعاد الفئات ذات النسبة 0% ما لم يكن الجدول ثنائياً
    const isBinary = sortedRows.length === 2;
    const activeRows = isBinary
      ? sortedRows
      : sortedRows.filter(r => r.percentage > 0);

    if (activeRows.length === 0) return "";

    // ─── حالة السيطرة الكاملة (100%) ───────────────────────────────────────
    if (activeRows.length === 1 || (activeRows[0].percentage === 100)) {
      return `يتضح من الجدول أن كافة أفراد عينة البحث انحصروا في فئة (${activeRows[0].answer}) بنسبة (${this.toIndic("100")}%).`;
    }

    // ترتيب تنازلي
    const sorted = [...activeRows].sort((a, b) => b.percentage - a.percentage);

    // ─── حالة التساوي الكلي (50/50) ─────────────────────────────────────────
    if (sorted.length === 2 && Math.abs(sorted[0].percentage - sorted[1].percentage) < 0.01) {
      return `أظهرت النتائج انقسام عينة البحث بالتساوي بين (${sorted[0].answer}) و(${sorted[1].answer}) بنسبة (${this.toIndic("50")}%) لكل منهما، وهو ما يشكل نصف عينة البحث لكل فئة.`;
    }

    // ─── حالة الأغلبية الكاسحة (90%+) ──────────────────────────────────────
    if (sorted[0].percentage >= 90 && sorted.length >= 2) {
      const topPct = this.formatDemoPct(sorted[0].percentage);
      const restPct = this.formatDemoPct(sorted[sorted.length - 1].percentage);
      return `يستحوذ أصحاب فئة (${sorted[0].answer}) على الغالبية العظمى من عينة البحث بنسبة ${topPct}، في حين مثّلت فئة (${sorted[sorted.length - 1].answer}) نسبة ضئيلة بلغت ${restPct}.`;
    }

    // ─── البناء العام: تجميع المتساويات ثم السرد التنازلي ───────────────────
    const groups = this.groupByPercentage(sorted);
    const sb: string[] = [];
    const semanticConfig = this.getSemanticConfig(questionText);

    groups.forEach((grp, index) => {
      const pctStr = this.formatDemoPct(grp.percentage);

      if (index === 0) {
        if (grp.items.length === 1) {
          const phrase = this.formatSemanticGroup(semanticConfig, grp.items, 'لـ ');
          sb.push(`يتضح من الجدول أن النسبة الأعلى كانت ${phrase} بنسبة ${pctStr}`);
        } else {
          const phrase = this.formatSemanticGroup(semanticConfig, grp.items, 'بين كلٌّ من ');
          sb.push(`يتضح من الجدول أن النسبة الأعلى كانت بالتساوي ${phrase} في الصدارة بنسبة ${pctStr} لكل منهما`);
        }
      } else if (index === groups.length - 1 && groups.length > 2) {
        if (grp.items.length === 1) {
          const phrase = this.formatSemanticGroup(semanticConfig, grp.items, '');
          sb.push(`، وأخيراً ${phrase} بنسبة ${pctStr}`);
        } else {
          const phrase = this.formatSemanticGroup(semanticConfig, grp.items, '');
          sb.push(`، وأخيراً تساوى كلٌّ من ${phrase} بنسبة ${pctStr} لكل منهما`);
        }
      } else {
        const connector = index === 1 ? "، يليها " : "، ثم ";
        if (grp.items.length === 1) {
          const phrase = this.formatSemanticGroup(semanticConfig, grp.items, '');
          sb.push(`${connector}${phrase} بنسبة ${pctStr}`);
        } else {
          const phrase = this.formatSemanticGroup(semanticConfig, grp.items, '');
          sb.push(`${connector}تساوى كلٌّ من ${phrase} بنسبة ${pctStr} لكل منهما`);
        }
      }
    });

    // ─── دمج الفئات الضئيلة جداً (≤3% لكل منها وعددها ≥3) ──────────────────
    const tinyGroups = groups.filter(g => g.percentage <= 3);
    if (tinyGroups.length >= 3) {
      const mainGroups = groups.filter(g => g.percentage > 3);
      const tinyNames = tinyGroups.flatMap(g => g.items).map(r => `(${r.answer})`).join(" و");
      const tinyTotal = tinyGroups.reduce((sum, g) => sum + g.items.reduce((s, r) => s + r.percentage, 0), 0);
      const tinyTotalStr = this.formatDemoPct(tinyTotal);

      const sbMain: string[] = [];
      mainGroups.forEach((grp, index) => {
        const pctStr = this.formatDemoPct(grp.percentage);
        
        if (index === 0) {
          if (grp.items.length === 1) {
            const phrase = this.formatSemanticGroup(semanticConfig, grp.items, 'لـ ');
            sbMain.push(`يتضح من الجدول أن النسبة الأعلى كانت ${phrase} بنسبة ${pctStr}`);
          } else {
            const phrase = this.formatSemanticGroup(semanticConfig, grp.items, 'بين كلٌّ من ');
            sbMain.push(`يتضح من الجدول أن النسبة الأعلى كانت بالتساوي ${phrase} في الصدارة بنسبة ${pctStr} لكل منهما`);
          }
        } else {
          const connector = index === 1 ? "، يليها " : "، ثم ";
          if (grp.items.length === 1) {
            const phrase = this.formatSemanticGroup(semanticConfig, grp.items, '');
            sbMain.push(`${connector}${phrase} بنسبة ${pctStr}`);
          } else {
            const phrase = this.formatSemanticGroup(semanticConfig, grp.items, '');
            sbMain.push(`${connector}تساوى كلٌّ من ${phrase} بنسبة ${pctStr} لكل منهما`);
          }
        }
      });
      sbMain.push(`، بينما توزعت النسب المتبقية الضئيلة على فئات ${tinyNames} بنسب لم تتجاوز في مجموعها ${tinyTotalStr}.`);
      return sbMain.join('');
    }

    sb.push(".");
    return sb.join('');
  }

  /**
   * تنظيف نص العبارة من العناوين الفرعية (مثل: أولاً: البعد الوظيفي)
   * والإبقاء فقط على النص الموجود بين القوسين [] إن وُجد، وإلا إرجاع النص كما هو
   */
  private static cleanQuestionText(text: string): string {
    // 1. محاولة استخلاص النص من النمط "اسم المجموعة [العبارة]"
    // النمط طماع (.+) لضمان التقاط الأقواس التوضيحية داخل العبارة
    const bracketMatch = text.match(/^(.+?)\s*[\[\(](.+)[\]\)]\s*$/);
    if (bracketMatch) {
      const prefix = bracketMatch[1].trim();
      const content = bracketMatch[2].trim();
      // لا نحذف الأقواس إذا كان النص قبلها يبدو كجزء من سؤال أو إذا كان قصيراً جداً
      if (prefix.length > 0 && !prefix.includes('؟')) {
        return content;
      }
    }

    // 2. إزالة العناوين الفرعية من نمط "أولاً: ... - " أو "البعد ... :"
    const cleaned = text
      .replace(/^(أولاً|ثانياً|ثالثاً|رابعاً|خامساً|سادساً|سابعاً|ثامناً|تاسعاً|عاشراً)\s*:\s*[^-\n]*[-–]\s*/u, '')
      .replace(/^البعد\s+[^:]+:\s*/u, '')
      .trim();
    return cleaned;
  }

  // ════════════════════════════════════════════════════════════════════════
  //  محرّك التحويل اللغوي: صياغة عبارات ليكرت بصيغة الجمع الغائب
  //  يعتمد على التعابير النمطية ومعالجة كامل كلمات الجملة.
  // ════════════════════════════════════════════════════════════════════════

  /** كلمات تبدأ بهمزة لكنها ليست أفعالاً للمتكلّم */
  private static readonly ALIF_NON_VERBS = new Set([
    'أن', 'أنّ', 'أو', 'أي', 'أيّ', 'أحد', 'إحدى', 'أكثر', 'أغلب', 'أقل',
    'أولى', 'أول', 'آخر', 'أبرز', 'أهم', 'أنا', 'أيضاً', 'أيضا',
    'أحياناً', 'أحيانا', 'أمام', 'أثناء', 'أبدا', 'أبداً', 'أفضل', 'أسوأ', 'أحسن',
    'أصعب', 'أسهل', 'أكبر', 'أصغر', 'أطول', 'أقصر', 'أغلى', 'أرخص', 'أسرع', 'أبطأ'
  ]);

  /** خريطة ضمائر المتكلّم المفرد إلى جمع الغائب (للاستخدام المباشر للكلمات المستقلة) */
  private static readonly PRONOUN_TO_PLURAL: Record<string, string> = {
    'لي': 'لهم', 'إليّ': 'إليهم', 'إلي': 'إليهم', 'عليّ': 'عليهم', 'علي': 'عليهم',
    'عندي': 'عندهم', 'لديّ': 'لديهم', 'لدي': 'لديهم', 'معي': 'معهم', 'مني': 'منهم',
    'عني': 'عنهم', 'بي': 'بهم', 'فيّ': 'فيهم', 'أنا': 'هم', 'نحن': 'هم'
  };

  /** هل الكلمة فعل مضارع للمتكلّم المفرد (يبدأ بهمزة قطع مفتوحة أو ممدودة)؟ */
  private static isFirstPersonVerb(word: string): boolean {
    const w = word.replace(/[.،,؛()"]/g, '').trim();
    if (w.length < 3) return false;
    const c0 = w[0];
    if (c0 !== 'أ' && c0 !== 'آ') return false;
    if (this.ALIF_NON_VERBS.has(w)) return false;
    return true;
  }

  /** تصريف فعل المتكلّم المفرد (أَفعَل) إلى الغائب جمع المذكّر (يَفعَلون) */
  private static conjugateVerbToPlural(verb: string): string {
    const w = verb.replace(/[.،,؛()"]/g, '').trim();
    if (w.length < 2) return verb;

    // استخراج الضمائر المتصلة (ها، ه، هم)
    let suffix = '';
    let core = w;
    if (w.endsWith('ها')) { suffix = 'ها'; core = w.slice(0, -2); }
    else if (w.endsWith('ه')) { suffix = 'ه'; core = w.slice(0, -1); }
    else if (w.endsWith('هم')) { suffix = 'هم'; core = w.slice(0, -2); }

    const IRREGULAR: Record<string, string> = {
      'أرى': 'يرون', 'آتي': 'يأتون', 'أعي': 'يعون', 'أبغي': 'يبغون'
    };

    if (IRREGULAR[core]) return IRREGULAR[core] + suffix;

    let stem: string;
    if (core[0] === 'آ') {
      stem = 'يأ' + core.slice(1);
    } else {
      stem = 'ي' + core.slice(1);
    }

    const last = stem[stem.length - 1];
    let conjugated = stem + 'ون';
    if (last === 'ى' || last === 'ي' || last === 'و' || last === 'ا') {
      conjugated = stem.slice(0, -1) + 'ون';
    }

    const prefixPunct = verb.match(/^[.،,؛()"]+/)?.[0] || '';
    const suffixPunct = verb.match(/[.،,؛()"]+$/)?.[0] || '';

    return prefixPunct + conjugated + suffix + suffixPunct;
  }

  /**
   * دالة متقدمة لمعالجة وتحويل الجملة بالكامل:
   * 1. تحويل أفعال المتكلم إلى الغائب جمع
   * 2. تحويل الضمائر المتصلة (ني -> هم)
   * 3. تحويل صفات الملكية (ياء المتكلم -> هم)
   * 4. تحويل الضمائر المنفصلة
   */
  private static smartPluralizeArabicText(text: string): string {
    // 1. إزالة الحشوات التعبيرية الافتتاحية
    let processed = text.replace(/^(أرى|أجد|أعتقد|أظن)\s+أن\s+/g, '');

    const words = processed.split(/(\s+)/);
    
    return words.map(tok => {
      if (!tok.trim()) return tok;

      const bare = tok.replace(/[.،,؛()"]/g, '');
      if (!bare) return tok;

      // 2. الضمائر المنفصلة
      if (this.PRONOUN_TO_PLURAL[bare]) {
        return tok.replace(bare, this.PRONOUN_TO_PLURAL[bare]);
      }

      // 3. أفعال المتكلم (أفعل -> يفعلون)
      if (this.isFirstPersonVerb(bare)) {
        return this.conjugateVerbToPlural(tok);
      }

      // 4. أفعال الغائب المفرد المتصلة بياء المتكلم أو نا (يفعلني/يفعلنا -> يفعلهم)
      if (bare.startsWith('ي') && bare.match(/(ني|نا)$/)) {
        return tok.replace(/(ني|نا)$/, 'هم');
      }

      // تحويل بعض الصفات من المفرد للجمع
      const ADJ_MAP: Record<string, string> = {
         'حزينا': 'حزينين', 'خائفا': 'خائفين', 'وحيدا': 'وحيدين',
         'حزيناً': 'حزينين', 'خائفاً': 'خائفين', 'وحيداً': 'وحيدين'
      };
      if (ADJ_MAP[bare]) {
        return tok.replace(bare, ADJ_MAP[bare]);
      }
      
      // 5. الأسماء المتصلة بياء المتكلم (الملكية)
      if (bare === 'والداي') return tok.replace('والداي', 'والديهم');
      if (bare === 'والدي') return tok.replace('والدي', 'والدهم');

      const POSSESSIVE_NOUNS = new Set([
         'مشاعري', 'أغراضي', 'عملي', 'وقتي', 'رأيي', 'صديقي', 'زميلي', 'معلمي', 
         'مديري', 'أخي', 'أختي', 'أبي', 'أمي', 'نفسي', 'ذاتي', 'حياتي', 
         'عمري', 'خاطري', 'شؤوني', 'مستقبلي', 'بيتي', 'منزلي', 'دوري', 'ملابسي',
         'كتبي', 'أشيائي'
      ]);

      if (POSSESSIVE_NOUNS.has(bare)) {
         return tok.replace(/ي(?=[.،,؛()"]*$|$)/, 'هم');
      }

      if (bare.endsWith('اتي')) {
         return tok.replace(/اتي(?=[.،,؛()"]*$|$)/, 'اتهم');
      }

      if (bare.endsWith('تي') && bare.length > 3) {
         const EXCLUDE_TI = new Set(['التي', 'متى', 'أنتي', 'يأتي']);
         if (!EXCLUDE_TI.has(bare)) {
             return tok.replace(/تي(?=[.،,؛()"]*$|$)/, 'تهم');
         }
      }

      return tok;
    }).join('');
  }


  /**
   * تصنيف قطبية الإجابة (إيجابية / أحياناً / سلبية) اعتماداً على ترتيب المقياس
   */
  private static classifyPolarity(
    label: string,
    scaleLabels: string[],
    direction?: 'positive' | 'negative'
  ): 'positive' | 'sometimes' | 'negative' {
    const l = label.trim();
    if (/أحيان/.test(l)) return 'sometimes';
    if (l === 'نعم') return direction === 'negative' ? 'negative' : 'positive';
    if (l === 'لا') return direction === 'negative' ? 'positive' : 'negative';

    const n = scaleLabels.length;
    const idx = scaleLabels.findIndex(s => s.trim() === l);
    if (idx === -1) {
      if (/^لا\s|^غير\s|بدون|أبدا|نادر|أرفض|سلب/.test(l)) return 'negative';
      return 'positive';
    }
    const pos = direction === 'negative' ? n - 1 - idx : idx;
    const mid = (n - 1) / 2;
    if (Math.abs(pos - mid) < 1e-9) return 'sometimes';
    return pos < mid ? 'positive' : 'negative';
  }

  /**
   * تحويل نص العبارة إلى مسند بصيغة الجمع الغائب وربط القطبية بالنفي أو التكرار.
   */

  private static toPluralPredicate(
    cleanText: string,
    polarity: 'positive' | 'sometimes' | 'negative'
  ): string {
    const text = cleanText.replace(/\.\s*$/, '').trim();
    const pluralized = this.smartPluralizeArabicText(text).trim();

    // فحص ما إذا كانت الجملة فعلية (تبدأ بفعل للغائب المذكر/المؤنث يـ/تـ)
    const firstWord = pluralized.replace(/^لا\s+/, '').split(' ')[0].replace(/[.،,؛()"]/g, '');
    const isVerbal = /^[يت]/.test(firstWord) && firstWord.length >= 3 && 
                     !['يوم', 'يوميا', 'يومياً', 'تأثير', 'تربية', 'تنمية', 'تعاون', 'توبيخ'].includes(firstWord);

    let body = pluralized;

    if (polarity === 'sometimes') {
        if (!isVerbal) {
             body = `يرون أحياناً أن ${pluralized}`;
        } else {
             body = `أحياناً ${body}`;
        }
    } else if (polarity === 'negative') {
        if (!isVerbal) {
             body = `لا يرون أن ${pluralized}`;
        } else {
             if (!body.startsWith('لا ') && !body.startsWith('غير ') && !body.startsWith('ليس ')) {
                 body = `لا ${body}`;
             }
        }
    } else {
        if (!isVerbal) {
             body = `يرون أن ${pluralized}`;
        }
    }

    return body;
  }

  /**
   * إنشاء تعليق تحليلي لمجموعة ليكرت بصيغة سردية (الجمع الغائب).
   * - عدد العبارات المُعلَّق عليها = ثلث عدد أسئلة المجموعة بحدٍّ أدنى ٧ (أو الكل إن قلّت).
   * - عند تساوي النسبة تُقدَّم الإجابة الإيجابية ثم "أحياناً" ثم السلبية.
   * - كل عبارة تُصاغ بصيغة الجمع الغائب مع إدراج النفي/"أحياناً" بدقة.
   */
  static generateGroupComment(group: LikertGroupResult): string {
    if (group.questions.length === 0) return "";

    const scaleLabels = group.scale?.labels ?? [];
    const polarityRank: Record<'positive' | 'sometimes' | 'negative', number> =
      { positive: 0, sometimes: 1, negative: 2 };

    type EnrichedQ = {
      cleanText: string;
      maxPercentage: number;
      maxLabel: string;
      polarity: 'positive' | 'sometimes' | 'negative';
    };

    // 1. لكل سؤال: أعلى نسبة وتسميتها وقطبيتها
    const enriched: EnrichedQ[] = group.questions
      .filter(q => q.responses && q.responses.length > 0)
      .map(q => {
        const maxResponse = q.responses.reduce(
          (max, curr) => (curr.percentage > max.percentage ? curr : max),
          q.responses[0]
        );
        return {
          cleanText: this.cleanQuestionText(q.text),
          maxPercentage: maxResponse.percentage,
          maxLabel: maxResponse.label,
          polarity: this.classifyPolarity(maxResponse.label, scaleLabels, q.direction),
        };
      });

    if (enriched.length === 0) return "";

    // 2. الترتيب: النسبة تنازلياً، ثم القطبية (إيجابية ← أحياناً ← سلبية)
    enriched.sort((a, b) =>
      b.maxPercentage - a.maxPercentage ||
      polarityRank[a.polarity] - polarityRank[b.polarity]
    );

    // 3. عدد العبارات المعروضة = min(N, max(ceil(N/3), 7))
    const N = enriched.length;
    const K = Math.min(N, Math.max(Math.ceil(N / 3), 7));
    const displayQuestions = enriched.slice(0, K);

    // 4. تجميع العبارات المتساوية في النسبة والتسمية معاً
    type QGroup = { percentage: number; label: string; items: EnrichedQ[] };
    const qGroups: QGroup[] = [];
    for (const q of displayQuestions) {
      const existing = qGroups.find(g => g.percentage === q.maxPercentage && g.label === q.maxLabel);
      if (existing) existing.items.push(q);
      else qGroups.push({ percentage: q.maxPercentage, label: q.maxLabel, items: [q] });
    }

    const pred = (q: EnrichedQ) => this.toPluralPredicate(q.cleanText, q.polarity);

    // 5. بناء الفقرة السردية
    const sb: string[] = [];
    qGroups.forEach((grp, index) => {
      const is100 = Math.abs(grp.percentage - 100) < 0.01;
      const pctStr = `(${this.toIndic(Number.isInteger(grp.percentage) ? grp.percentage.toString() : grp.percentage.toFixed(1))}%)`;

      const lead = is100
        ? (index === 0 ? `يتضح من الجدول: أن كافة أفراد عينة البحث ` : `، وأن كافة أفراد عينة البحث `)
        : (index === 0 ? `يتضح من الجدول: أن ${pctStr} من أفراد عينة البحث ` : `، وأن ${pctStr} منهم `);

      sb.push(`${lead}${pred(grp.items[0])}`);
      for (let i = 1; i < grp.items.length; i++) {
        sb.push(`، وأن ${pctStr} منهم ${pred(grp.items[i])}`);
      }
    });

    sb.push(".");
    return sb.join('').replace(/، وأن \([^)]+\) منهم ، وأن/g, '، وأن');
  }

  /**
   * إنشاء ملخص إحصائي شامل للتقرير (الخلاصة العامة)
   */
  static generateReportSummary(groups: LikertGroupResult[], generalResults: DemographicResult[]): string {
    const sb: string[] = [];
    sb.push("الملخص التنفيذي للتقرير:\n\n");

    // إحصائيات عامة
    const totalQuestions = groups.reduce((sum, group) => sum + group.questions.length, 0);
    const totalGeneralQuestions = generalResults.length;

    sb.push("إحصائيات التقرير:\n");
    sb.push(`- عدد المحاور: ${this.toIndic(groups.length.toString())}\n`);
    sb.push(`- عدد الأسئلة التحليلية: ${this.toIndic(totalQuestions.toString())}\n`);
    sb.push(`- عدد الأسئلة العامة: ${this.toIndic(totalGeneralQuestions.toString())}\n\n`);

    // أعلى المحاور
    if (groups.length > 0) {
        const groupsWithAverage = groups.map(group => ({
          ...group,
          average: this.calculateGroupAverage(group)
        })).sort((a, b) => b.average - a.average);

        sb.push("أبرز النتائج:\n");
        sb.push(`- أعلى محور تقييماً: '${groupsWithAverage[0].groupName}' `);
        sb.push(`(${this.toIndic(groupsWithAverage[0].average.toFixed(2))})\n`);

        if (groupsWithAverage.length > 1) {
            const lowest = groupsWithAverage[groupsWithAverage.length - 1];
            sb.push(`- أقل محور تقييماً: '${lowest.groupName}' `);
            sb.push(`(${this.toIndic(lowest.average.toFixed(2))})\n`);
        }
    }

    return sb.join('');
  }

  /**
   * حساب متوسط تقديري للمجموعة بناءً على توزيع الإجابات
   * (يفترض مقياس ليكرت من 1 إلى عدد الخيارات)
   */
  private static calculateGroupAverage(group: LikertGroupResult): number {
    if (group.questions.length === 0) return 0;

    let totalWeightedSum = 0;
    let totalResponses = 0;

    group.questions.forEach(question => {
      question.responses.forEach((response, index) => {
        // إعطاء وزن لكل خيار (1, 2, 3, ...)
        const weight = index + 1;
        totalWeightedSum += response.count * weight;
        totalResponses += response.count;
      });
    });

    return totalResponses > 0 ? totalWeightedSum / totalResponses : 0;
  }
}
