package com.placement.codinglab.runner;

import com.placement.codinglab.model.TestCaseResult;
import com.placement.codinglab.model.TestCaseResult.CaseStatus;
import org.w3c.dom.Document;
import org.w3c.dom.Element;
import org.w3c.dom.Node;
import org.w3c.dom.NodeList;
import org.xml.sax.InputSource;
import org.xml.sax.helpers.DefaultHandler;

import javax.xml.XMLConstants;
import javax.xml.parsers.DocumentBuilder;
import javax.xml.parsers.DocumentBuilderFactory;
import java.io.StringReader;
import java.util.ArrayList;
import java.util.List;

/**
 * Reads the JUnit-XML report that every sandbox runtime emits (JUnit Console, pytest --junitxml, node:test's
 * junit reporter). The XML is written by a process that runs UNTRUSTED student code, so it is parsed
 * defensively: DOCTYPE/external entities disabled (no XXE), size and case-count capped.
 */
public final class JUnitXmlParser {

    private static final int MAX_CHARS = 2_000_000;
    private static final int MAX_CASES = 500;
    private static final int MAX_MESSAGE = 400;

    private JUnitXmlParser() {}

    public static List<TestCaseResult> parse(String xml, String suite) {
        if (xml == null || xml.isBlank()) return List.of();
        if (xml.length() > MAX_CHARS) throw new IllegalArgumentException("Test report is too large");
        xml = sanitize(xml);
        try {
            DocumentBuilderFactory f = DocumentBuilderFactory.newInstance();
            f.setFeature("http://apache.org/xml/features/disallow-doctype-decl", true);
            f.setFeature(XMLConstants.FEATURE_SECURE_PROCESSING, true);
            f.setFeature("http://xml.org/sax/features/external-general-entities", false);
            f.setFeature("http://xml.org/sax/features/external-parameter-entities", false);
            f.setXIncludeAware(false);
            f.setExpandEntityReferences(false);
            DocumentBuilder builder = f.newDocumentBuilder();
            builder.setErrorHandler(new DefaultHandler()); // no stderr spam when a student writes garbage into the report
            Document doc = builder.parse(new InputSource(new StringReader(xml)));

            List<TestCaseResult> out = new ArrayList<>();
            NodeList cases = doc.getElementsByTagName("testcase");
            for (int i = 0; i < cases.getLength() && out.size() < MAX_CASES; i++) {
                Element tc = (Element) cases.item(i);
                String name = TestNaming.clean(tc.getAttribute("name"));
                CaseStatus status = CaseStatus.PASSED;
                String message = "";
                for (Node c = tc.getFirstChild(); c != null; c = c.getNextSibling()) {
                    if (!(c instanceof Element e)) continue;
                    switch (e.getTagName()) {
                        case "failure" -> { status = CaseStatus.FAILED; message = messageOf(e); }
                        case "error" -> { status = CaseStatus.ERROR; message = messageOf(e); }
                        case "skipped" -> { status = CaseStatus.SKIPPED; message = messageOf(e); }
                        default -> { }
                    }
                }
                out.add(new TestCaseResult(suite, name, TestNaming.requirementId(name), status, message, millis(tc.getAttribute("time"))));
            }
            return out;
        } catch (IllegalArgumentException e) {
            throw e;
        } catch (Exception e) {
            throw new IllegalArgumentException("Test report could not be read (" + e.getClass().getSimpleName() + ")");
        }
    }

    private static final java.util.regex.Pattern ANSI = java.util.regex.Pattern.compile("\u001B\\[[0-9;?]*[ -/]*[@-~]");
    private static final java.util.regex.Pattern ILLEGAL_XML = java.util.regex.Pattern.compile("[^\\x09\\x0A\\x0D\\x20-\\uD7FF\\uE000-\\uFFFD\\x{10000}-\\x{10FFFF}]");

    /** Test tools sometimes emit colour codes / control characters that are illegal in XML 1.0 and would make an
     *  otherwise fine report unparseable (one coloured assertion diff used to void the whole run). Strip them first. */
    static String sanitize(String xml) {
        return ILLEGAL_XML.matcher(ANSI.matcher(xml).replaceAll("")).replaceAll("");
    }

    private static String messageOf(Element e) {
        String m = e.getAttribute("message");
        if (m == null || m.isBlank()) m = e.getTextContent();
        if (m == null) return "";
        String[] lines = m.replace("\r", "").replace("/tmp/p2p-out/", "").strip().split("\n");
        StringBuilder sb = new StringBuilder();
        for (int i = 0; i < Math.min(3, lines.length); i++) {
            if (i > 0) sb.append('\n');
            sb.append(lines[i].strip());
        }
        String s = sb.toString();
        return s.length() > MAX_MESSAGE ? s.substring(0, MAX_MESSAGE) + "…" : s;
    }

    private static int millis(String seconds) {
        try {
            return (int) Math.round(Double.parseDouble(seconds) * 1000);
        } catch (Exception e) {
            return 0;
        }
    }
}
