use rust_xlsxwriter::{Chart, ChartType, Format, FormatAlign, Workbook};
use serde::Deserialize;

#[derive(Deserialize, Debug)]
pub struct DemographicResponse {
    pub answer: String,
    pub count: u32,
    pub percentage: f64,
}

#[derive(Deserialize, Debug)]
pub struct DemographicResult {
    pub question: String,
    pub responses: Vec<DemographicResponse>,
    pub commentary: Option<String>,
}

#[derive(Deserialize, Debug)]
pub struct LikertScale {
    pub labels: Vec<String>,
}

#[derive(Deserialize, Debug)]
pub struct LikertResponse {
    pub count: u32,
    pub percentage: f64,
}

#[derive(Deserialize, Debug)]
pub struct LikertQuestion {
    pub index: u32,
    pub text: String,
    pub responses: Vec<LikertResponse>,
}

#[derive(Deserialize, Debug)]
#[allow(non_snake_case)]
pub struct LikertGroupResult {
    pub groupName: String,
    pub scale: LikertScale,
    pub questions: Vec<LikertQuestion>,
    pub commentary: Option<String>,
}

fn sanitize_sheet_name(name: &str) -> String {
    let mut safe = name.replace(&['\\', '/', '*', '?', ':', '[', ']'][..], "_");
    if safe.is_empty() {
        safe = "Sheet".to_string();
    }
    if safe.chars().count() > 31 {
        safe = safe.chars().take(31).collect();
    }
    safe
}

#[tauri::command]
pub fn export_native_excel(
    file_path: &str,
    demographics: Vec<DemographicResult>,
    likert: Vec<LikertGroupResult>,
    general_commentary: Option<String>,
) -> Result<(), String> {
    let mut workbook = Workbook::new();

    let header_format = Format::new()
        .set_bold()
        .set_align(FormatAlign::Center)
        .set_align(FormatAlign::VerticalCenter);
    let right_align = Format::new().set_align(FormatAlign::Right);
    let center_align = Format::new().set_align(FormatAlign::Center);

    let text_wrap_format = Format::new()
        .set_text_wrap()
        .set_align(FormatAlign::Top)
        .set_align(FormatAlign::Right);

    for (i, demo) in demographics.iter().enumerate() {
        let sheet_name = sanitize_sheet_name(&format!("د{} {}", i + 1, demo.question));
        let worksheet = workbook
            .add_worksheet()
            .set_name(&sheet_name)
            .map_err(|e| e.to_string())?;
        worksheet.set_right_to_left(true);

        worksheet.set_column_width(0, 35).unwrap();
        worksheet.set_column_width(1, 15).unwrap();
        worksheet.set_column_width(2, 20).unwrap();

        worksheet
            .write_with_format(0, 0, "الإجابة", &header_format)
            .unwrap();
        worksheet
            .write_with_format(0, 1, "التكرار", &header_format)
            .unwrap();
        worksheet
            .write_with_format(0, 2, "النسبة المئوية %", &header_format)
            .unwrap();

        let row_start: u32 = 1;
        let mut row = row_start;
        let mut total_count = 0u32;

        if demo.responses.is_empty() {
            // عمود فارغ — كتابة صف "لا توجد إجابات"
            worksheet
                .write_with_format(row, 0, "لا توجد إجابات", &right_align)
                .unwrap();
            worksheet
                .write_number_with_format(row, 1, 0.0, &center_align)
                .unwrap();
            worksheet
                .write_string_with_format(row, 2, "0%", &center_align)
                .unwrap();
            row += 1;
        } else {
            for resp in &demo.responses {
                worksheet
                    .write_with_format(row, 0, &resp.answer, &right_align)
                    .unwrap();
                worksheet
                    .write_number_with_format(row, 1, resp.count as f64, &center_align)
                    .unwrap();
                worksheet
                    .write_string_with_format(row, 2, &format!("{}%", resp.percentage), &center_align)
                    .unwrap();
                total_count += resp.count;
                row += 1;
            }
        }

        row += 1;
        let total_format = Format::new().set_bold().set_align(FormatAlign::Right);
        worksheet
            .write_with_format(row, 0, "الإجمالي", &total_format)
            .unwrap();
        worksheet
            .write_number_with_format(row, 1, total_count as f64, &header_format)
            .unwrap();
        worksheet
            .write_string_with_format(row, 2, "100%", &header_format)
            .unwrap();

        let mut next_row = row + 2;

        if let Some(commentary) = &demo.commentary {
            worksheet
                .merge_range(next_row, 0, next_row + 2, 2, commentary, &text_wrap_format)
                .unwrap();
            next_row += 4;
        }

        // Add native Bar Chart — فقط إذا كانت هناك بيانات فعلية
        if !demo.responses.is_empty() {
            let mut chart = Chart::new(ChartType::Column);
            let data_end_row = row_start + demo.responses.len() as u32 - 1;

            chart
                .add_series()
                .set_categories((
                    sheet_name.as_str(),
                    row_start,
                    0_u16,
                    data_end_row,
                    0_u16,
                ))
                .set_values((
                    sheet_name.as_str(),
                    row_start,
                    1_u16,
                    data_end_row,
                    1_u16,
                ))
                .set_name("التكرار");

            chart.title().set_name(&demo.question);
            chart.legend().set_hidden();

            worksheet.insert_chart(next_row, 0, &chart).unwrap();
        }
    }

    // Likert
    for lik in likert.iter() {
        if lik.questions.is_empty() {
            continue;
        }
        let sheet_name = sanitize_sheet_name(&lik.groupName);
        let worksheet = match workbook.add_worksheet().set_name(&sheet_name) {
            Ok(ws) => ws,
            Err(_) => {
                // If duplicate or issue, just add untitiled
                workbook.add_worksheet()
            }
        };
        worksheet.set_right_to_left(true);

        worksheet.set_column_width(0, 8).unwrap();
        worksheet.set_column_width(1, 45).unwrap();

        let mut col = 2;
        for _ in &lik.scale.labels {
            worksheet.set_column_width(col, 10).unwrap();
            worksheet.set_column_width(col + 1, 10).unwrap();
            col += 2;
        }

        worksheet
            .merge_range(0, 0, 1, 0, "م", &header_format)
            .unwrap();
        worksheet
            .merge_range(0, 1, 1, 1, "العبارة", &header_format)
            .unwrap();

        let mut c_idx = 2;
        for label in &lik.scale.labels {
            worksheet
                .merge_range(0, c_idx, 0, c_idx + 1, label, &header_format)
                .unwrap();
            worksheet
                .write_with_format(1, c_idx, "التكرار", &header_format)
                .unwrap();
            worksheet
                .write_with_format(1, c_idx + 1, "النسبة %", &header_format)
                .unwrap();
            c_idx += 2;
        }

        let mut row = 2;
        for q in &lik.questions {
            worksheet
                .write_number_with_format(row, 0, q.index as f64, &center_align)
                .unwrap();
            worksheet
                .write_with_format(row, 1, &q.text, &right_align)
                .unwrap();

            let mut q_col = 2;
            for resp in &q.responses {
                worksheet
                    .write_number_with_format(row, q_col, resp.count as f64, &center_align)
                    .unwrap();
                worksheet
                    .write_string_with_format(
                        row,
                        q_col + 1,
                        &format!("{}%", resp.percentage),
                        &center_align,
                    )
                    .unwrap();
                q_col += 2;
            }
            row += 1;
        }

        if let Some(commentary) = &lik.commentary {
            let cols_count = lik.scale.labels.len() as u16 * 2 + 1;
            worksheet
                .merge_range(
                    row + 1,
                    0,
                    row + 4,
                    cols_count,
                    commentary,
                    &text_wrap_format,
                )
                .unwrap();
        }
    }

    if let Some(general) = general_commentary {
        if let Ok(worksheet) = workbook.add_worksheet().set_name("الخلاصة العامة") {
            worksheet.set_right_to_left(true);
            worksheet.set_column_width(0, 80).unwrap();
            worksheet
                .merge_range(2, 0, 15, 0, &general, &text_wrap_format)
                .unwrap();
        }
    }

    workbook.save(file_path).map_err(|e| e.to_string())
}
