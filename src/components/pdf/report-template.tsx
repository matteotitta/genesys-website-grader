import {
  Document,
  Page,
  Text,
  View,
  StyleSheet,
  Image,
  Link,
} from '@react-pdf/renderer';
import type { PMScoreResult, PMScoreDimension } from '@/types/analysis';

// Using built-in Helvetica font - most reliable for server-side PDF generation
// Custom fonts (General Sans) would require TTF files served locally

// Genesys white favicon URL (served from public folder via absolute URL)
const GENESYS_FAVICON_URL = '/favicon.png';

const colors = {
  background: '#1E2347',
  card: '#252b52',
  primary: '#939BED',
  brand: '#6400D7',
  white: '#F7F7F7',
  gray: '#C8D1D3',
  border: '#353d6a',
  green: '#10b981',
  teal: '#7AFFFF',
  greenAccent: '#A4FF98',
  yellow: '#FFE566',
  orange: '#FF7733',
  red: '#f43f5e',
};

// Dimension tooltip definitions
const DIMENSION_TOOLTIPS: Record<string, string> = {
  productClarity: "Can visitors understand what you sell within 5 seconds?",
  audienceSpecificity: "Is the target buyer explicitly identified?",
  problemArticulation: "Is the pain you solve clearly stated?",
  trustAndProof: "Are there testimonials, logos, or case studies?",
  outcomeClarity: "Can visitors envision their transformation?",
  differentiation: "Is it clear why you're better than alternatives?",
  productVisualization: "Can visitors see the product in action?",
  pricingClarity: "Can visitors understand what they'll pay?",
  riskReduction: "Are guarantees and risk reducers present?",
  actionClarity: "Is the primary CTA obvious and compelling?",
};

// Dimension order for rendering
const DIMENSION_ORDER = [
  'productClarity',
  'audienceSpecificity',
  'problemArticulation',
  'trustAndProof',
  'outcomeClarity',
  'differentiation',
  'productVisualization',
  'pricingClarity',
  'riskReduction',
  'actionClarity',
];


const styles = StyleSheet.create({
  page: {
    backgroundColor: colors.background,
    padding: 40,
    paddingBottom: 70,
    fontFamily: 'Helvetica',
    color: colors.white,
  },
  coverPage: {
    backgroundColor: colors.background,
    padding: 60,
    fontFamily: 'Helvetica',
    color: colors.white,
    display: 'flex',
    flexDirection: 'column',
    justifyContent: 'center',
    alignItems: 'center',
  },
  logo: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  logoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 50,
  },
  logoSeparator: {
    fontSize: 28,
    color: colors.gray,
    marginHorizontal: 20,
  },
  companyFavicon: {
    width: 48,
    height: 48,
    borderRadius: 8,
  },
  headerLogo: {
    width: 24,
    height: 24,
    borderRadius: 4,
  },
  pageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'flex-end',
    marginBottom: 20,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: colors.border,
  },
  coverTitle: {
    fontSize: 28,
    fontWeight: 600,
    color: colors.white,
    marginBottom: 16,
    textAlign: 'center',
    lineHeight: 1.3,
  },
  coverSubtitle: {
    fontSize: 14,
    color: colors.gray,
    textAlign: 'center',
    lineHeight: 1.6,
  },
  coverUrl: {
    fontSize: 14,
    color: colors.primary,
    marginTop: 50,
    textAlign: 'center',
    fontWeight: 500,
  },
  header: {
    fontSize: 20,
    fontWeight: 600,
    marginBottom: 16,
    color: colors.white,
  },
  subheader: {
    fontSize: 13,
    fontWeight: 600,
    marginBottom: 10,
    color: colors.white,
  },
  card: {
    backgroundColor: colors.card,
    borderRadius: 8,
    padding: 14,
    marginBottom: 10,
  },
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 6,
  },
  dimensionName: {
    fontSize: 11,
    color: colors.white,
    flex: 1,
    fontWeight: 500,
  },
  score: {
    fontSize: 11,
    fontWeight: 600,
    color: colors.primary,
  },
  totalScore: {
    fontSize: 52,
    fontWeight: 600,
    color: colors.primary,
    textAlign: 'center',
  },
  grade: {
    fontSize: 18,
    fontWeight: 600,
    textAlign: 'center',
    marginTop: 6,
  },
  text: {
    fontSize: 10,
    color: colors.gray,
    lineHeight: 1.6,
  },
  bulletPoint: {
    fontSize: 10,
    color: colors.white,
    marginBottom: 6,
    paddingLeft: 10,
    lineHeight: 1.5,
  },
  bullet: {
    color: colors.primary,
  },
  footer: {
    position: 'absolute',
    bottom: 25,
    left: 40,
    right: 40,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  footerText: {
    fontSize: 9,
    color: colors.gray,
  },
  footerLink: {
    fontSize: 9,
    color: colors.primary,
    textDecoration: 'none',
  },
  pageNumber: {
    fontSize: 9,
    color: colors.gray,
    textAlign: 'center',
    position: 'absolute',
    bottom: 25,
    right: 40,
  },
  strengthItem: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    marginBottom: 8,
  },
  strengthNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  strengthNumberText: {
    fontSize: 9,
    fontWeight: 600,
    color: colors.green,
  },
  improvementNumber: {
    width: 18,
    height: 18,
    borderRadius: 9,
    backgroundColor: 'rgba(147, 155, 237, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 8,
  },
  improvementNumberText: {
    fontSize: 9,
    fontWeight: 600,
    color: colors.primary,
  },
  progressBar: {
    height: 6,
    backgroundColor: colors.border,
    borderRadius: 3,
    marginTop: 4,
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    borderRadius: 3,
  },
  tooltip: {
    fontSize: 9,
    color: colors.gray,
    marginTop: 4,
    marginBottom: 8,
  },
  dimensionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 8,
  },
  dimensionTitle: {
    fontSize: 14,
    fontWeight: 600,
    color: colors.white,
  },
  scoreBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  scoreBadgeText: {
    fontSize: 11,
    fontWeight: 600,
  },
  suggestionCard: {
    backgroundColor: 'rgba(147, 155, 237, 0.1)',
    borderRadius: 6,
    padding: 10,
    marginTop: 8,
    borderLeftWidth: 3,
    borderLeftColor: colors.primary,
  },
  suggestionTitle: {
    fontSize: 10,
    fontWeight: 600,
    color: colors.primary,
    marginBottom: 6,
  },
});

function getGradeColor(grade: string): string {
  switch (grade) {
    case 'A': return colors.greenAccent;
    case 'B': return colors.teal;
    case 'C': return colors.yellow;
    case 'D': return colors.orange;
    case 'F': return colors.red;
    default: return colors.primary;
  }
}

function getProgressColor(percentage: number): string {
  if (percentage >= 80) return colors.greenAccent;
  if (percentage >= 60) return colors.teal;
  if (percentage >= 40) return colors.yellow;
  return colors.red;
}

function getScoreBadgeColor(percentage: number): string {
  if (percentage >= 80) return 'rgba(164, 255, 152, 0.2)';
  if (percentage >= 60) return 'rgba(122, 255, 255, 0.2)';
  if (percentage >= 40) return 'rgba(255, 229, 102, 0.2)';
  return 'rgba(244, 63, 94, 0.2)';
}

// Page header with Genesys logo on top-right
function PageHeader({ genesysFaviconUrl }: { genesysFaviconUrl: string }) {
  return (
    <View style={styles.pageHeader}>
      <Image src={genesysFaviconUrl} style={styles.headerLogo} />
    </View>
  );
}

// Page footer with CTA and page number
function PageFooter() {
  return (
    <View style={styles.footer} fixed>
      <Text style={styles.footerText}>
        Want to improve your positioning?{' '}
      </Text>
      <Link src="https://cal.com/matteo-titta/30min" style={styles.footerLink}>
        Book a call with Matteo → cal.com/matteo-titta/30min
      </Link>
    </View>
  );
}

// Dimension deep dive component
function DimensionDeepDive({ dimension, companyName }: { dimension: PMScoreDimension; companyName: string }) {
  const percentage = Math.round((dimension.score / dimension.maxPoints) * 100);
  const progressColor = getProgressColor(percentage);
  const badgeColor = getScoreBadgeColor(percentage);
  const tooltip = DIMENSION_TOOLTIPS[dimension.id] || '';

  return (
    <View style={styles.card} wrap={false} minPresenceAhead={100}>
      {/* Header with title and score badge */}
      <View style={styles.dimensionHeader}>
        <Text style={styles.dimensionTitle}>{dimension.name}</Text>
        <View style={{ ...styles.scoreBadge, backgroundColor: badgeColor }}>
          <Text style={{ ...styles.scoreBadgeText, color: progressColor }}>
            {dimension.score}/{dimension.maxPoints} ({percentage}%)
          </Text>
        </View>
      </View>

      {/* Progress bar */}
      <View style={styles.progressBar}>
        <View
          style={{
            ...styles.progressFill,
            width: `${percentage}%`,
            backgroundColor: progressColor,
          }}
        />
      </View>

      {/* Tooltip definition */}
      <Text style={styles.tooltip}>{tooltip}</Text>

      {/* Analysis */}
      <Text style={{ ...styles.text, color: colors.white, lineHeight: 1.7 }}>
        {dimension.analysis}
      </Text>

      {/* Evidence - compact single block with bullets */}
      {dimension.evidence.length > 0 && (
        <View style={{ flexDirection: 'row', marginTop: 6 }}>
          <View style={{ width: 3, backgroundColor: colors.teal, borderRadius: 1, marginRight: 8 }} />
          <View style={{ flex: 1 }}>
            {dimension.evidence.slice(0, 3).map((item, i) => (
              <Text key={i} style={{ fontSize: 9, color: colors.gray, lineHeight: 1.4, marginBottom: 2 }}>
                • "{item}"
              </Text>
            ))}
          </View>
        </View>
      )}

      {/* Suggestions */}
      {dimension.suggestions.length > 0 && (
        <View style={styles.suggestionCard}>
          <Text style={styles.suggestionTitle}>Recommendations</Text>
          {dimension.suggestions.slice(0, 2).map((sug, i) => (
            <Text key={i} style={styles.bulletPoint}>
              <Text style={styles.bullet}>• </Text>
              {sug}
            </Text>
          ))}
        </View>
      )}
    </View>
  );
}

interface PDFReportProps {
  url: string;
  pmScore: PMScoreResult;
  generatedAt: string;
  baseUrl?: string; // Base URL for serving static assets (e.g., https://example.com)
}

export function PDFReport({ url, pmScore, generatedAt, baseUrl = '' }: PDFReportProps) {
  const gradeColor = getGradeColor(pmScore.grade);

  // Extract company name from URL
  const getCompanyName = (siteUrl: string) => {
    try {
      const hostname = new URL(siteUrl).hostname.replace('www.', '');
      const name = hostname.split('.')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    } catch {
      return 'Website';
    }
  };

  const companyName = getCompanyName(url);
  const faviconUrl = `https://www.google.com/s2/favicons?domain=${new URL(url).hostname}&sz=128`;

  // Genesys icon URL - needs absolute URL for PDF rendering
  const genesysFaviconUrl = baseUrl ? `${baseUrl}${GENESYS_FAVICON_URL}` : GENESYS_FAVICON_URL;

  // Get ordered dimensions
  const orderedDimensions = DIMENSION_ORDER.map(id =>
    pmScore.dimensions[id as keyof typeof pmScore.dimensions]
  ).filter(Boolean);

  return (
    <Document>
      {/* Cover Page */}
      <Page size="A4" style={styles.coverPage}>
        {/* Logo row: Genesys icon x Company favicon */}
        <View style={styles.logoRow}>
          <Image src={genesysFaviconUrl} style={styles.logo} />
          <Text style={styles.logoSeparator}>×</Text>
          <Image src={faviconUrl} style={styles.companyFavicon} />
        </View>
        <Text style={styles.coverTitle}>
          {companyName}'s Home Page{'\n'}Positioning Recommendations
        </Text>
        <Text style={styles.coverSubtitle}>
          Positioning analysis across 10 core product marketing dimensions
        </Text>
        <Text style={styles.coverUrl}>{url}</Text>
        <Text style={{ ...styles.coverSubtitle, marginTop: 40 }}>
          Generated: {new Date(generatedAt).toLocaleDateString('en-US', {
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          })}
        </Text>
        <View style={{ position: 'absolute', bottom: 50, left: 0, right: 0, alignItems: 'center' }}>
          <Text style={{ fontSize: 11, color: colors.gray }}>
            Prepared by{' '}
            <Link src="https://cal.com/matteo-titta/30min" style={{ color: colors.primary, textDecoration: 'none' }}>
              Matteo Tittarelli — cal.com/matteo-titta/30min
            </Link>
          </Text>
        </View>
      </Page>

      {/* Page 1: Grade + Summary + Key Findings */}
      <Page size="A4" style={styles.page}>
        <PageHeader genesysFaviconUrl={genesysFaviconUrl} />
        <Text style={styles.header}>Overview</Text>

        {/* Score Card */}
        <View style={{ ...styles.card, alignItems: 'center', paddingVertical: 20, marginBottom: 16 }}>
          <Text style={styles.totalScore}>{pmScore.totalScore}</Text>
          <Text style={{ ...styles.text, marginTop: 2 }}>out of {pmScore.maxScore}</Text>
          <Text style={{ ...styles.grade, color: gradeColor, marginTop: 8 }}>
            Grade {pmScore.grade}
          </Text>
        </View>

        {/* Executive Summary */}
        <Text style={styles.subheader}>Executive Summary</Text>
        <View style={{ ...styles.card, marginBottom: 16 }}>
          <Text style={{ ...styles.text, lineHeight: 1.7 }}>{pmScore.summary}</Text>
        </View>

        {/* Key Findings side by side */}
        <View style={{ flexDirection: 'row', gap: 12 }}>
          {/* Strengths */}
          <View style={{ flex: 1 }}>
            <Text style={styles.subheader}>Top Strengths</Text>
            <View style={styles.card}>
              {pmScore.topStrengths.slice(0, 3).map((strength, index) => (
                <View key={index} style={styles.strengthItem}>
                  <View style={styles.strengthNumber}>
                    <Text style={styles.strengthNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={{ ...styles.text, flex: 1, color: colors.white, fontSize: 9 }}>{strength}</Text>
                </View>
              ))}
            </View>
          </View>

          {/* Improvements */}
          <View style={{ flex: 1 }}>
            <Text style={styles.subheader}>Priority Improvements</Text>
            <View style={styles.card}>
              {pmScore.priorityImprovements.slice(0, 3).map((improvement, index) => (
                <View key={index} style={styles.strengthItem}>
                  <View style={styles.improvementNumber}>
                    <Text style={styles.improvementNumberText}>{index + 1}</Text>
                  </View>
                  <Text style={{ ...styles.text, flex: 1, color: colors.white, fontSize: 9 }}>{improvement}</Text>
                </View>
              ))}
            </View>
          </View>
        </View>

        <PageFooter />
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* Page 2: Dimension Scores */}
      <Page size="A4" style={styles.page}>
        <PageHeader genesysFaviconUrl={genesysFaviconUrl} />
        <Text style={styles.header}>Dimension Scores</Text>

        <View style={styles.card}>
          {orderedDimensions.map((dim) => {
            const percentage = Math.round((dim.score / dim.maxPoints) * 100);
            const progressColor = getProgressColor(percentage);
            return (
              <View key={dim.id} style={{ marginBottom: 14 }}>
                <View style={styles.row}>
                  <Text style={styles.dimensionName}>{dim.name}</Text>
                  <Text style={{ ...styles.score, color: progressColor }}>
                    {dim.score}/{dim.maxPoints} ({percentage}%)
                  </Text>
                </View>
                <View style={styles.progressBar}>
                  <View
                    style={{
                      ...styles.progressFill,
                      width: `${percentage}%`,
                      backgroundColor: progressColor,
                    }}
                  />
                </View>
              </View>
            );
          })}
        </View>

        {/* Legend */}
        <View style={{ flexDirection: 'row', justifyContent: 'center', marginTop: 16, gap: 16 }}>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, backgroundColor: colors.greenAccent, borderRadius: 2, marginRight: 6 }} />
            <Text style={{ fontSize: 9, color: colors.gray }}>80-100%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, backgroundColor: colors.teal, borderRadius: 2, marginRight: 6 }} />
            <Text style={{ fontSize: 9, color: colors.gray }}>60-79%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, backgroundColor: colors.yellow, borderRadius: 2, marginRight: 6 }} />
            <Text style={{ fontSize: 9, color: colors.gray }}>40-59%</Text>
          </View>
          <View style={{ flexDirection: 'row', alignItems: 'center' }}>
            <View style={{ width: 12, height: 12, backgroundColor: colors.red, borderRadius: 2, marginRight: 6 }} />
            <Text style={{ fontSize: 9, color: colors.gray }}>0-39%</Text>
          </View>
        </View>

        <PageFooter />
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* Deep Dive Pages - dimensions flow with automatic page breaks */}
      <Page size="A4" style={styles.page} wrap>
        <PageHeader genesysFaviconUrl={genesysFaviconUrl} />
        <Text style={styles.header} fixed>Deep Dive Analysis</Text>

        {orderedDimensions.map((dim) => (
          <DimensionDeepDive
            key={dim.id}
            dimension={dim}
            companyName={companyName}
          />
        ))}

        <PageFooter />
        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>

      {/* Final CTA Page */}
      <Page size="A4" style={{ ...styles.page, justifyContent: 'center', alignItems: 'center' }}>
        <PageHeader genesysFaviconUrl={genesysFaviconUrl} />

        <View style={{ flex: 1, justifyContent: 'center', alignItems: 'center' }}>
          <Text style={{ fontSize: 24, fontWeight: 600, color: colors.white, textAlign: 'center', marginBottom: 16 }}>
            Ready to improve your positioning?
          </Text>
          <Text style={{ fontSize: 12, color: colors.gray, textAlign: 'center', marginBottom: 30, maxWidth: 400, lineHeight: 1.6 }}>
            I've helped 45+ B2B SaaS companies transform their messaging. Let's discuss how to apply these recommendations to your homepage.
          </Text>
          <Link
            src="https://cal.com/matteo-titta/30min"
            style={{
              backgroundColor: colors.primary,
              paddingHorizontal: 24,
              paddingVertical: 12,
              borderRadius: 8,
              textDecoration: 'none'
            }}
          >
            <Text style={{ fontSize: 14, fontWeight: 600, color: colors.background }}>
              Book a call with Matteo
            </Text>
          </Link>
          <Text style={{ fontSize: 11, color: colors.gray, marginTop: 12 }}>
            cal.com/matteo-titta/30min
          </Text>
        </View>

        <Text style={styles.pageNumber} render={({ pageNumber, totalPages }) => `${pageNumber} / ${totalPages}`} fixed />
      </Page>
    </Document>
  );
}
