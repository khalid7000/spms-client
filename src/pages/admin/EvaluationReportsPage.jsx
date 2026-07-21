// Admin/HR screen: browse concluded Annual Evaluations for a given academic year and
// download the final signed report as a PDF. Visible to both ADMIN and HR roles (unlike
// the rest of the admin console, which is ADMIN-only) -- see ProtectedRoute's requiredRoles.
import { useState } from 'react'
import { Card, Select, Table, Tag, Button, message, Empty, Typography } from 'antd'
import { DownloadOutlined } from '@ant-design/icons'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { getAcademicYears } from '../../api/academicYears'
import { getConcludedEvaluations, downloadEvaluationPdf } from '../../api/annualEvaluations'
import { useTablePrefs, compareStrings } from '../../hooks/useTablePrefs'
import { useTerminology } from '../../TerminologyContext'

const { Paragraph } = Typography

const TABLE_PREFS_KEY = 'spms.evaluationReportsTable.prefs'

export default function EvaluationReportsPage() {
  const { t } = useTranslation()
  const { academicYearLabel, defaultHeadTitleLabel } = useTerminology()
  const [academicYearId, setAcademicYearId] = useState(null)
  const { prefs, sortOrderFor, handleTableChange } = useTablePrefs(TABLE_PREFS_KEY)

  const { data: academicYears = [] } = useQuery({ queryKey: ['academic-years'], queryFn: getAcademicYears })

  const { data: evaluations = [], isLoading } = useQuery({
    queryKey: ['concluded-evaluations', academicYearId],
    queryFn: () => getConcludedEvaluations(academicYearId),
    enabled: !!academicYearId,
  })

  const handleDownload = async (evaluation) => {
    try {
      const resp = await downloadEvaluationPdf(evaluation.id)
      const url = window.URL.createObjectURL(new Blob([resp.data]))
      const a = document.createElement('a')
      a.href = url
      a.download = `annual-evaluation-${evaluation.employeeName.replace(/\s+/g, '-')}-${evaluation.academicYearName}.pdf`
      a.click()
      window.URL.revokeObjectURL(url)
    } catch (err) {
      message.error(err.response?.data?.message || t('evalReports.downloadFailed'))
    }
  }

  const columns = [
    {
      title: t('goalSetting.employeeLabel'), dataIndex: 'employeeName', key: 'employeeName',
      sorter: (a, b) => compareStrings(a.employeeName, b.employeeName), sortOrder: sortOrderFor('employeeName'),
    },
    { title: defaultHeadTitleLabel, dataIndex: 'headName', key: 'headName' },
    { title: t('orgEval.overallRankColLabel'), dataIndex: 'headOverallRank', key: 'headOverallRank' },
    {
      title: t('evalReports.concludedColLabel'), dataIndex: 'headSignedAt', key: 'headSignedAt',
      render: (v) => v ? new Date(v).toLocaleDateString() : '—',
    },
    { title: t('common.status'), dataIndex: 'state', key: 'state', render: () => <Tag color="success">{t('evalReports.concludedTag')}</Tag> },
    {
      title: t('evalReports.reportColLabel'), key: 'report',
      render: (_, row) => (
        <Button size="small" icon={<DownloadOutlined />} onClick={() => handleDownload(row)}>{t('evalReports.downloadPdfButton')}</Button>
      ),
    },
  ]

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('evalReports.pageTitle')}</h1>
      </div>
      <Card>
        <Paragraph type="secondary">
          {t('evalReports.intro')}
        </Paragraph>
        <Select
          style={{ width: 220, marginBottom: 16 }} placeholder={academicYearLabel} value={academicYearId}
          onChange={setAcademicYearId} options={academicYears.map((y) => ({ value: y.id, label: y.name }))}
        />
        {!academicYearId ? (
          <Empty description={t('goalReview.selectYearEmpty', { yearLabel: academicYearLabel })} />
        ) : (
          <Table
            dataSource={evaluations} columns={columns} rowKey="id" loading={isLoading}
            pagination={{
              current: prefs.current, pageSize: prefs.pageSize, showSizeChanger: true,
              showTotal: (total) => t('achievementLog.totalCount', { count: total }),
            }}
            onChange={handleTableChange}
            locale={{ emptyText: t('evalReports.noConcludedEvaluations') }}
          />
        )}
      </Card>
    </div>
  )
}
