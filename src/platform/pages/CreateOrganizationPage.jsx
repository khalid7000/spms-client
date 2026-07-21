// Full page rather than a modal: a file upload plus live slug-availability checking are both
// awkward to cram into a small modal. Reserved-word/format validation for the slug stays
// server-side only (OrgSlugValidator is the single source of truth) -- this page just
// surfaces whatever error comes back rather than duplicating that rule list.
import { useState, useEffect, useRef } from 'react'
import { Form, Input, Button, Checkbox, Upload, message } from 'antd'
import { UploadOutlined, CheckCircleFilled, CloseCircleFilled } from '@ant-design/icons'
import { useMutation, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useNavigate } from 'react-router-dom'
import { createOrganization, checkSlugAvailable } from '../../api/platformOrganizations'

function slugify(text) {
  return text
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 50)
}

export default function CreateOrganizationPage() {
  const { t } = useTranslation()
  const navigate = useNavigate()
  const qc = useQueryClient()
  const [form] = Form.useForm()
  const [slugTouched, setSlugTouched] = useState(false)
  const [slugStatus, setSlugStatus] = useState(null) // null | 'checking' | 'available' | 'taken'
  const [logoFile, setLogoFile] = useState(null)
  const debounceRef = useRef(null)

  const checkSlug = (slug) => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!slug) { setSlugStatus(null); return }
    setSlugStatus('checking')
    debounceRef.current = setTimeout(async () => {
      try {
        const available = await checkSlugAvailable(slug)
        setSlugStatus(available ? 'available' : 'taken')
      } catch {
        setSlugStatus(null)
      }
    }, 400)
  }

  useEffect(() => () => { if (debounceRef.current) clearTimeout(debounceRef.current) }, [])

  const handleNameChange = (e) => {
    if (!slugTouched) {
      const nextSlug = slugify(e.target.value)
      form.setFieldsValue({ slug: nextSlug })
      checkSlug(nextSlug)
    }
  }

  const handleSlugChange = (e) => {
    setSlugTouched(true)
    checkSlug(slugify(e.target.value))
  }

  const createMutation = useMutation({
    mutationFn: (values) => {
      const formData = new FormData()
      formData.append('name', values.name)
      formData.append('slug', values.slug)
      if (values.address) formData.append('address', values.address)
      if (values.description) formData.append('description', values.description)
      formData.append('isDefault', !!values.isDefault)
      formData.append('adminEmail', values.adminEmail)
      formData.append('adminPassword', values.adminPassword)
      if (logoFile) formData.append('logo', logoFile)
      return createOrganization(formData)
    },
    onSuccess: () => {
      message.success(t('platformConsole.organizationCreated'))
      qc.invalidateQueries({ queryKey: ['platform-dashboard'] })
      navigate('/console/organizations')
    },
    onError: (err) => message.error(err.response?.data?.message || t('tree.operationFailed')),
  })

  return (
    <div>
      <div className="page-header">
        <h1 className="page-title">{t('platformConsole.createOrganizationTitle')}</h1>
      </div>

      <Form form={form} layout="vertical" onFinish={createMutation.mutate} style={{ maxWidth: 520 }}>
        <Form.Item name="name" label={t('platformConsole.organizationNameLabel')} rules={[{ required: true }]}>
          <Input onChange={handleNameChange} />
        </Form.Item>

        <Form.Item name="slug" label={t('platformConsole.slugLabel')} rules={[{ required: true }]}
          extra={
            slugStatus === 'checking' ? t('platformConsole.slugChecking')
              : slugStatus === 'available' ? <span style={{ color: '#52c41a' }}><CheckCircleFilled /> {t('platformConsole.slugAvailable')}</span>
              : slugStatus === 'taken' ? <span style={{ color: '#ef4444' }}><CloseCircleFilled /> {t('platformConsole.slugTaken')}</span>
              : t('platformConsole.slugHint')
          }>
          <Input onChange={handleSlugChange} />
        </Form.Item>

        <Form.Item name="address" label={t('platformConsole.addressLabel')}>
          <Input />
        </Form.Item>

        <Form.Item name="description" label={t('common.description')}>
          <Input.TextArea rows={3} />
        </Form.Item>

        <Form.Item label={t('platformConsole.logoLabel')}>
          <Upload
            beforeUpload={(file) => { setLogoFile(file); return false }}
            onRemove={() => setLogoFile(null)}
            fileList={logoFile ? [{ uid: '-1', name: logoFile.name }] : []}
            accept="image/*"
            maxCount={1}
          >
            <Button icon={<UploadOutlined />}>{t('platformConsole.chooseLogoButton')}</Button>
          </Upload>
        </Form.Item>

        <Form.Item name="adminEmail" label={t('platformConsole.adminEmailLabel')}
          rules={[{ required: true, type: 'email' }]}>
          <Input />
        </Form.Item>

        <Form.Item name="adminPassword" label={t('platformConsole.adminPasswordLabel')} rules={[{ required: true }]}
          extra={t('platformConsole.adminPasswordHint')}>
          <Input.Password />
        </Form.Item>

        <Form.Item name="isDefault" valuePropName="checked">
          <Checkbox>{t('platformConsole.isDefaultLabel')}</Checkbox>
        </Form.Item>

        <div style={{ display: 'flex', gap: 8 }}>
          <Button type="primary" htmlType="submit" loading={createMutation.isPending}
            style={{ background: '#13223a' }}>
            {t('platformConsole.createOrganizationButton')}
          </Button>
          <Button onClick={() => navigate('/console/organizations')}>{t('common.cancel')}</Button>
        </div>
      </Form>
    </div>
  )
}
