package scripts.datasets;

import com.fasterxml.jackson.databind.ObjectMapper;
import com.multilingo.backend.modules.exam.dto.request.ExamBuilderRequest;
import com.multilingo.backend.modules.exam.dto.response.ExamDatasetBundle;
import com.multilingo.backend.modules.exam.service.ExamParserService;
import org.springframework.mock.web.MockMultipartFile;

import java.io.InputStream;
import java.nio.file.Files;
import java.nio.file.Path;

public final class BuildCambridgeIeltsBundle {
    private static final String SOURCE =
            "/datasets/official-source/cambridge-ielts-20-test-1-full.v2.xlsx";
    private static final String EXAM_CODE = "IELTS-CAMBRIDGE-20-T1-V2";

    private BuildCambridgeIeltsBundle() {}

    public static void main(String[] args) throws Exception {
        Path output = args.length == 0
                ? Path.of("src", "main", "resources", "datasets", "exams",
                "cambridge-ielts-20-test-1.v2.json")
                : Path.of(args[0]);
        ObjectMapper mapper = new ObjectMapper();
        ExamBuilderRequest request;
        try (InputStream input = BuildCambridgeIeltsBundle.class.getResourceAsStream(SOURCE)) {
            if (input == null) throw new IllegalStateException("Missing source fixture: " + SOURCE);
            request = new ExamParserService(mapper).parseExamFile(new MockMultipartFile("file",
                    "Cambridge_Ielts_20_Test_1_(Full_giai_thich).xlsx",
                    "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                    input.readAllBytes()));
        }
        ExamDatasetBundle bundle = ExamDatasetBundle.exportForCode(request, EXAM_CODE);
        bundle.validate();
        Files.createDirectories(output.getParent());
        mapper.writerWithDefaultPrettyPrinter().writeValue(output.toFile(), bundle);
        System.out.println("Wrote validated bundle " + output + " checksum=" + bundle.checksum());
    }
}
