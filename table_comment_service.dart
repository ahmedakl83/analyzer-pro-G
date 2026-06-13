import '../models/survey_group.dart';
import '../models/question_result.dart';
import '../models/general_result.dart';

/// خدمة مستقلة لإنشاء التعليقات التحليلية على الجداول النهائية
/// تحتوي على جميع منطق التعليق والتحليل المستخرج من المشروع
class TableCommentService {
  
  /// تحويل الأرقام الإنجليزية إلى الأرقام العربية الهندية
  String toIndic(String input) {
    const english = ['0', '1', '2', '3', '4', '5', '6', '7', '8', '9'];
    const arabic = ['٠', '١', '٢', '٣', '٤', '٥', '٦', '٧', '٨', '٩'];
    for (int i = 0; i < english.length; i++) {
      input = input.replaceAll(english[i], arabic[i]);
    }
    return input;
  }

  /// إنشاء تعليق تحليلي للبيانات العامة (الديموغرافية)
  /// يحلل النتائج ويرتبها حسب الأهمية ويقدم تفسيراً شاملاً
  String generateGeneralComment(List<Map<String, dynamic>> sortedRows) {
    if (sortedRows.isEmpty) return "";
    
    StringBuffer sb = StringBuffer();
    sb.write("يتضح من الجدول أن أعلى قيمة كانت للفئة '${sortedRows[0]['option']}' ");
    sb.write("وكانت نسبتها المئوية ${toIndic(sortedRows[0]['percent'].toString())} ");
    
    if (sortedRows.length > 1) {
       sb.write("يليها الفئة '${sortedRows[1]['option']}' وكانت نسبتها ${toIndic(sortedRows[1]['percent'].toString())} ");
    }
    
    // إضافة باقي الفئات إن وجدت
    for(int i = 2; i < sortedRows.length; i++) {
        sb.write("، ثم '${sortedRows[i]['option']}' (${toIndic(sortedRows[i]['percent'].toString())})");
    }
    sb.write(".");
    
    return sb.toString();
  }

  /// إنشاء تعليق تحليلي شامل لمجموعة من الأسئلة
  /// يتضمن ترتيب الأسئلة حسب نسبة الموافقة وتحليل الاتجاه العام
  String generateGroupComment(SurveyGroup group) {
    if(group.questions.isEmpty) return "";
    
    // 1. ترتيب الأسئلة حسب نسبة الموافقة (تنازلي)
    var sortedQuestions = List<QuestionResult>.from(group.questions);
    sortedQuestions.sort((a, b) => b.yesPercent.compareTo(a.yesPercent));

    StringBuffer sb = StringBuffer();

    // 2. عرض أعلى 5 أسئلة موافقة
    int displayCount = sortedQuestions.length < 5 ? sortedQuestions.length : 5;
    sb.write("بناءً على النتائج الموضحة في الجدول، نلاحظ أن أعلى العبارات موافقة هي:\n");
    
    for(int i = 0; i < displayCount; i++) {
        var question = sortedQuestions[i];
        sb.write("${i + 1}- '${question.questionText}' بنسبة موافقة ${toIndic(question.yesPercent.toStringAsFixed(1))}%\n");
    }

    // 3. تحليل الاتجاه العام للمجموعة
    double totalYes = 0;
    double totalNo = 0;
    for(var question in group.questions) {
        totalYes += question.yesCount;
        totalNo += question.noCount;
    }
    
    sb.write("\nوبشكل عام، ");
    if (totalYes > totalNo) {
        sb.write("يتجه رأي المشاركين في هذا المحور نحو الإيجاب (موافقة) حيث طغت إجابات 'نعم' على إجابات 'لا'.");
    } else if (totalNo > totalYes) {
        sb.write("يظهر هناك تحفظ لدى المشاركين في هذا المحور حيث كانت نسبة 'لا' هي الغالبة.");
    } else {
        sb.write("كانت آراء المشاركين متباينة بين الموافقة والرفض بشكل متقارب.");
    }

    return sb.toString();
  }

  /// إنشاء تعليق مفصل لمجموعة مع تحليل إحصائي متقدم
  String generateAdvancedGroupComment(SurveyGroup group) {
    if(group.questions.isEmpty) return "";
    
    StringBuffer sb = StringBuffer();
    
    // 1. تحليل المتوسط العام للمجموعة
    double groupAverage = group.groupAverage;
    sb.write("التحليل الإحصائي للمحور '${group.name}':\n\n");
    sb.write("المتوسط العام للمحور: ${toIndic(groupAverage.toStringAsFixed(2))}\n");
    
    // تفسير المتوسط
    if (groupAverage >= 2.5) {
        sb.write("يشير هذا المتوسط إلى اتجاه إيجابي عام نحو عبارات هذا المحور.\n\n");
    } else if (groupAverage >= 2.0) {
        sb.write("يشير هذا المتوسط إلى اتجاه محايد مع ميل طفيف نحو الإيجابية.\n\n");
    } else {
        sb.write("يشير هذا المتوسط إلى وجود تحفظات لدى المشاركين حول عبارات هذا المحور.\n\n");
    }

    // 2. تحليل توزيع الإجابات
    int totalResponses = 0;
    int totalYes = 0;
    int totalSometimes = 0;
    int totalNo = 0;
    
    for(var question in group.questions) {
        totalResponses += question.total;
        totalYes += question.yesCount;
        totalSometimes += question.sometimesCount;
        totalNo += question.noCount;
    }
    
    if (totalResponses > 0) {
        double yesPercent = (totalYes / totalResponses) * 100;
        double sometimesPercent = (totalSometimes / totalResponses) * 100;
        double noPercent = (totalNo / totalResponses) * 100;
        
        sb.write("توزيع الإجابات الإجمالي:\n");
        sb.write("- نعم: ${toIndic(yesPercent.toStringAsFixed(1))}%\n");
        sb.write("- أحياناً: ${toIndic(sometimesPercent.toStringAsFixed(1))}%\n");
        sb.write("- لا: ${toIndic(noPercent.toStringAsFixed(1))}%\n\n");
    }

    // 3. تحديد أقوى وأضعف العبارات
    var sortedQuestions = List<QuestionResult>.from(group.questions);
    sortedQuestions.sort((a, b) => b.yesPercent.compareTo(a.yesPercent));
    
    if (sortedQuestions.isNotEmpty) {
        var strongest = sortedQuestions.first;
        var weakest = sortedQuestions.last;
        
        sb.write("أقوى العبارات موافقة:\n");
        sb.write("'${strongest.questionText}' بنسبة ${toIndic(strongest.yesPercent.toStringAsFixed(1))}%\n\n");
        
        sb.write("أضعف العبارات موافقة:\n");
        sb.write("'${weakest.questionText}' بنسبة ${toIndic(weakest.yesPercent.toStringAsFixed(1))}%\n\n");
    }

    // 4. التوصيات
    sb.write("التوصيات:\n");
    if (groupAverage >= 2.5) {
        sb.write("- الحفاظ على النقاط الإيجابية الحالية وتعزيزها\n");
        sb.write("- التركيز على العبارات ذات النسب الأقل لتحسينها\n");
    } else {
        sb.write("- إعادة النظر في العبارات ذات النسب المنخفضة\n");
        sb.write("- وضع خطط تحسين للمحور بشكل عام\n");
    }

    return sb.toString();
  }

  /// إنشاء تعليق مقارن بين مجموعات متعددة
  String generateComparativeComment(List<SurveyGroup> groups) {
    if (groups.isEmpty) return "";
    
    StringBuffer sb = StringBuffer();
    sb.write("التحليل المقارن بين المحاور:\n\n");
    
    // ترتيب المجموعات حسب المتوسط
    var sortedGroups = List<SurveyGroup>.from(groups);
    sortedGroups.sort((a, b) => b.groupAverage.compareTo(a.groupAverage));
    
    sb.write("ترتيب المحاور حسب المتوسط العام:\n");
    for (int i = 0; i < sortedGroups.length; i++) {
        var group = sortedGroups[i];
        sb.write("${i + 1}. ${group.name}: ${toIndic(group.groupAverage.toStringAsFixed(2))}\n");
    }
    
    sb.write("\nالتحليل:\n");
    if (sortedGroups.isNotEmpty) {
        var highest = sortedGroups.first;
        var lowest = sortedGroups.last;
        
        sb.write("- أعلى محور: '${highest.name}' بمتوسط ${toIndic(highest.groupAverage.toStringAsFixed(2))}\n");
        sb.write("- أقل محور: '${lowest.name}' بمتوسط ${toIndic(lowest.groupAverage.toStringAsFixed(2))}\n");
        
        double difference = highest.groupAverage - lowest.groupAverage;
        sb.write("- الفارق بين أعلى وأقل محور: ${toIndic(difference.toStringAsFixed(2))}\n");
    }
    
    return sb.toString();
  }

  /// إنشاء تعليق للأسئلة ذات القيم المخصصة (مقياس ليكرت مخصص)
  String generateCustomScaleComment(QuestionResult question) {
    if (question.detectedValues.isEmpty || question.customCounts.isEmpty) {
        return "";
    }
    
    StringBuffer sb = StringBuffer();
    sb.write("تحليل السؤال: '${question.questionText}'\n\n");
    
    // ترتيب القيم حسب العدد
    var sortedEntries = question.customCounts.entries.toList();
    sortedEntries.sort((a, b) => b.value.compareTo(a.value));
    
    sb.write("توزيع الإجابات:\n");
    for (var entry in sortedEntries) {
        double percent = question.total == 0 ? 0.0 : (entry.value / question.total) * 100;
        sb.write("- ${entry.key}: ${toIndic(entry.value.toString())} (${toIndic(percent.toStringAsFixed(1))}%)\n");
    }
    
    // تحليل الاتجاه
    if (sortedEntries.isNotEmpty) {
        var mostSelected = sortedEntries.first;
        sb.write("\nالتحليل: الإجابة الأكثر اختياراً هي '${mostSelected.key}' ");
        double percent = question.total == 0 ? 0.0 : (mostSelected.value / question.total) * 100;
        sb.write("بنسبة ${toIndic(percent.toStringAsFixed(1))}%، ");
        
        if (percent > 50) {
            sb.write("مما يشير إلى اتجاه واضح نحو هذا الخيار.");
        } else if (percent > 30) {
            sb.write("مما يشير إلى ميل نسبي نحو هذا الخيار.");
        } else {
            sb.write("مما يشير إلى تنوع في الآراء.");
        }
    }
    
    return sb.toString();
  }

  /// إنشاء ملخص إحصائي شامل للتقرير
  String generateReportSummary(List<SurveyGroup> groups, List<GeneralQuestionResult> generalResults) {
    StringBuffer sb = StringBuffer();
    sb.write("الملخص التنفيذي للتقرير:\n\n");
    
    // إحصائيات عامة
    int totalQuestions = groups.fold(0, (sum, group) => sum + group.questions.length);
    int totalGeneralQuestions = generalResults.length;
    
    sb.write("إحصائيات التقرير:\n");
    sb.write("- عدد المحاور: ${toIndic(groups.length.toString())}\n");
    sb.write("- عدد الأسئلة التحليلية: ${toIndic(totalQuestions.toString())}\n");
    sb.write("- عدد الأسئلة العامة: ${toIndic(totalGeneralQuestions.toString())}\n\n");
    
    // أعلى المحاور
    if (groups.isNotEmpty) {
        var sortedGroups = List<SurveyGroup>.from(groups);
        sortedGroups.sort((a, b) => b.groupAverage.compareTo(a.groupAverage));
        
        sb.write("أبرز النتائج:\n");
        sb.write("- أعلى محور تقييماً: '${sortedGroups.first.name}' ");
        sb.write("(${toIndic(sortedGroups.first.groupAverage.toStringAsFixed(2))})\n");
        
        if (sortedGroups.length > 1) {
            sb.write("- أقل محور تقييماً: '${sortedGroups.last.name}' ");
            sb.write("(${toIndic(sortedGroups.last.groupAverage.toStringAsFixed(2))})\n");
        }
    }
    
    return sb.toString();
  }
}