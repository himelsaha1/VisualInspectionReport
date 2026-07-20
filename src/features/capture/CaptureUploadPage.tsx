import { useCallback, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  Button,
  ComboBox,
  FileUploader,
  Form,
  FormGroup,
  InlineNotification,
  Select,
  SelectItem,
  Heading,
  SkeletonText,
  InlineLoading,
} from '@carbon/react'
import { ArrowLeft, Upload } from '@carbon/icons-react'
import { useAssets } from '@/hooks/useAssets'
import { createInspection } from '@/services/inspection.service'
import { buildAnalysisRoute, ROUTES } from '@/constants/routes'
import {
  MAX_IMAGES,
  MAX_IMAGE_SIZE_BYTES,
  ACCEPTED_IMAGE_TYPES,
} from '@/constants/inspection.constants'
import type { Asset, InspectionType } from '@/types'
import './CaptureUploadPage.scss'

const INSPECTION_TYPES: { id: InspectionType; label: string }[] = [
  { id: 'visual', label: 'Visual' },
  { id: 'thermal', label: 'Thermal' },
  { id: 'structural', label: 'Structural' },
]

export default function CaptureUploadPage() {
  const navigate = useNavigate()
  const { assets, loading: assetsLoading } = useAssets()

  const [selectedAsset, setSelectedAsset] = useState<Asset | null>(null)
  const [inspectionType, setInspectionType] = useState<InspectionType>('visual')
  const [images, setImages] = useState<File[]>([])
  const [imagePreviews, setImagePreviews] = useState<string[]>([])
  const [validationError, setValidationError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  // Carbon FileUploader onChange receives FileItem objects (addedFiles[].file = File)
  const handleFilesAdded = useCallback(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (_event: React.SyntheticEvent<HTMLElement>, data?: any) => {
      type FileItemLike = { file?: File }
      const added: File[] = (data?.addedFiles ?? [])
        .map((item: FileItemLike) => (item?.file instanceof File ? item.file : null))
        .filter((f: File | null): f is File => f !== null)
      const valid = added.filter(file => {
        if (!ACCEPTED_IMAGE_TYPES.includes(file.type)) return false
        if (file.size > MAX_IMAGE_SIZE_BYTES) return false
        return true
      })

      const remaining = MAX_IMAGES - images.length
      const toAdd = valid.slice(0, remaining)

      const previews = toAdd.map(file => URL.createObjectURL(file))
      setImages(prev => [...prev, ...toAdd])
      setImagePreviews(prev => [...prev, ...previews])
      setValidationError(null)
    },
    [images.length]
  )

  const removeImage = (index: number) => {
    URL.revokeObjectURL(imagePreviews[index])
    setImages(prev => prev.filter((_, i) => i !== index))
    setImagePreviews(prev => prev.filter((_, i) => i !== index))
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()

    if (!selectedAsset) {
      setValidationError('Please select an asset before continuing.')
      return
    }
    if (images.length === 0) {
      setValidationError('Please upload at least one image before continuing.')
      return
    }

    setValidationError(null)
    setSubmitting(true)

    try {
      const inspection = await createInspection({
        assetId: selectedAsset.id,
        assetName: selectedAsset.name,
        assetNum: selectedAsset.assetNum,
        inspectionType,
        createdBy: 'j.smith@ibm.com', // TODO: replace with auth.service.getCurrentUser()
        imageUrls: imagePreviews,
      })
      navigate(buildAnalysisRoute(inspection.id))
    } catch {
      setValidationError('Failed to create inspection. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="capture-page">
      <Heading style={{ marginBlockEnd: '0.5rem' }}>Start inspection</Heading>
      <p style={{ marginBlockEnd: '2rem', color: 'var(--cds-text-secondary)' }}>
        Select an asset, choose the inspection type, and upload images for analysis.
      </p>

      <Form onSubmit={handleSubmit}>
        {/* Asset selector */}
        <FormGroup legendText="" className="capture-page__section">
          {assetsLoading ? (
            <SkeletonText heading width="60%" />
          ) : (
            <ComboBox
              id="asset-selector"
              titleText="Asset"
              placeholder="Search or select an asset..."
              items={assets}
              itemToString={item => (item ? `${item.name} (${item.assetNum})` : '')}
              selectedItem={selectedAsset}
              onChange={({ selectedItem }) => setSelectedAsset(selectedItem ?? null)}
              helperText="Select the asset you are inspecting"
            />
          )}
        </FormGroup>

        {/* Inspection type */}
        <FormGroup legendText="" className="capture-page__section">
          <Select
            id="inspection-type"
            labelText="Inspection type"
            value={inspectionType}
            onChange={e => setInspectionType(e.target.value as InspectionType)}
          >
            {INSPECTION_TYPES.map(t => (
              <SelectItem key={t.id} value={t.id} text={t.label} />
            ))}
          </Select>
        </FormGroup>

        {/* Image upload */}
        <FormGroup legendText="Images" className="capture-page__section">
          <FileUploader
            labelTitle="Upload inspection images"
            labelDescription={`JPG, PNG, or WebP only. Max ${MAX_IMAGES} images, 10 MB each.`}
            buttonLabel="Add images"
            buttonKind="secondary"
            accept={ACCEPTED_IMAGE_TYPES}
            multiple
            filenameStatus="edit"
            iconDescription="Remove file"
            onChange={handleFilesAdded}
          />

          {imagePreviews.length > 0 && (
            <div className="capture-page__preview-grid">
              {imagePreviews.map((src, idx) => (
                <div key={src} className="capture-page__preview-item">
                  <img src={src} alt={`Preview ${idx + 1}`} className="capture-page__preview-img" />
                  <button
                    type="button"
                    className="capture-page__preview-remove"
                    aria-label={`Remove image ${idx + 1}`}
                    onClick={() => removeImage(idx)}
                  >
                    ×
                  </button>
                </div>
              ))}
            </div>
          )}
        </FormGroup>

        {/* Validation error */}
        {validationError && (
          <InlineNotification
            kind="error"
            title=""
            subtitle={validationError}
            onCloseButtonClick={() => setValidationError(null)}
            style={{ marginBlockEnd: '1rem' }}
          />
        )}

        {/* Actions */}
        <div className="capture-page__actions">
          <Button
            kind="ghost"
            renderIcon={ArrowLeft}
            onClick={() => navigate(ROUTES.INSPECTIONS)}
            disabled={submitting}
          >
            Cancel
          </Button>

          <Button
            type="submit"
            renderIcon={submitting ? undefined : Upload}
            disabled={submitting || !selectedAsset || images.length === 0}
          >
            {submitting ? (
              <InlineLoading description="Creating inspection…" />
            ) : (
              'Analyse images'
            )}
          </Button>
        </div>
      </Form>
    </div>
  )
}
