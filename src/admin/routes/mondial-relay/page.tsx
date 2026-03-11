import { defineRouteConfig } from "@medusajs/admin-sdk"
import { Container, Heading, Text, Button, Table, Badge, IconButton, FocusModal } from "@medusajs/ui"
import { ArrowDownTray, TruckFast, MapPin, Clock } from "@medusajs/icons"
import { useState, useEffect } from "react"

interface TrackingDetails {
  success: boolean
  status?: string
  trackingNumber?: string
  tracking_events?: Array<{
    date: string
    status: string
    location: string
  }>
}

interface Shipment {
  id: string
  orderId: string
  orderDisplayId: number
  customerName: string
  itemsCount: number
  trackingNumber: string
  status: string
  labelUrl: string
}

const MondialRelayPage = () => {
  const [shipments, setShipments] = useState<Shipment[]>([])
  const [loading, setLoading] = useState(true)
  const [trackingModalOpen, setTrackingModalOpen] = useState(false)
  const [trackingDetails, setTrackingDetails] = useState<TrackingDetails | null>(null)
  const [trackingLoading, setTrackingLoading] = useState(false)
  const [trackingError, setTrackingError] = useState<string | null>(null)
  const [selectedShipment, setSelectedShipment] = useState<Shipment | null>(null)

  const loadShipments = async () => {
    try {
      setLoading(true)
      console.log('🔄 Chargement des expéditions...')
      const response = await fetch('/admin/mondial-relay/shipments', {
        cache: 'no-cache',
        headers: {
          'Cache-Control': 'no-cache'
        }
      })
      const data = await response.json()
      console.log('📦 Expéditions chargées:', data.shipments?.length || 0)
      setShipments(data.shipments || [])
    } catch (error) {
      console.error('❌ Erreur chargement expéditions:', error)
    } finally {
      setLoading(false)
    }
  }

  const downloadLabel = (labelUrl: string) => {
    console.log('🎯 VERSION MISE À JOUR - downloadLabel appelé avec:', labelUrl)
    if (labelUrl && labelUrl !== '#') {
      console.log('✅ Ouverture de l\'étiquette:', labelUrl)
      window.open(labelUrl, '_blank')
    } else {
      console.warn('⚠️ Aucune URL d\'étiquette disponible')
      alert('Aucune étiquette disponible pour cette expédition')
    }
  }

  const trackShipment = async (shipment: any) => {
    setSelectedShipment(shipment)
    setTrackingModalOpen(true)
    setTrackingLoading(true)
    setTrackingError(null)
    setTrackingDetails(null)

    try {
      console.log('📦 Suivi de l\'expédition:', shipment.trackingNumber)
      const response = await fetch(`/admin/mondial-relay/tracking/${shipment.trackingNumber}`, {
        cache: 'no-cache',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json'
        }
      })
      
      if (response.status === 401) {
        throw new Error('Non authentifié')
      }
      
      const data = await response.json()
      console.log('📊 Données de suivi:', data)
      
      if (data.success) {
        setTrackingDetails(data)
      } else {
        setTrackingError(data.message || 'Impossible de récupérer les détails du suivi')
      }
    } catch (error) {
      console.error('❌ Erreur suivi:', error)
      setTrackingError((error as Error).message || 'Erreur lors de la récupération du suivi')
    } finally {
      setTrackingLoading(false)
    }
  }

  useEffect(() => {
    console.log('🎯 PAGE MONDIALE RELAY CHARGÉE - VERSION MISE À JOUR DU BOUTON ÉTIQUETTE')
    loadShipments()
  }, [])

  return (
    <Container className="divide-y p-0">
      {/* Header */}
      <div className="p-6 border-b" style={{ background: 'linear-gradient(to right, #1e293b, #0f172a)' }}>
        <div className="flex items-center justify-between">
          <div>
            <Heading level="h1" className="flex items-center gap-3" style={{ color: 'white' }}>
              <MapPin className="w-8 h-8" style={{ color: '#60a5fa' }} />
              Expéditions Mondial Relay
            </Heading>
            <Text className="mt-1" style={{ color: '#d1d5db' }}>
              Gérez vos expéditions et suivez vos colis en temps réel
            </Text>
          </div>
          <Button onClick={loadShipments} variant="primary" className="flex items-center gap-2">
            <Clock className="w-4 h-4" />
            Rafraîchir
          </Button>
        </div>
      </div>

      {/* Shipments List */}
      <div className="p-6">
        {loading ? (
          <Text>Chargement des expéditions...</Text>
        ) : shipments.length === 0 ? (
          <Text>Aucune expédition trouvée.</Text>
        ) : (
          <Table>
            <Table.Header>
              <Table.Row>
                <Table.HeaderCell>N° Suivi</Table.HeaderCell>
                <Table.HeaderCell>Commande</Table.HeaderCell>
                <Table.HeaderCell>Client</Table.HeaderCell>
                <Table.HeaderCell>Articles</Table.HeaderCell>
                <Table.HeaderCell>Statut</Table.HeaderCell>
                <Table.HeaderCell>Actions</Table.HeaderCell>
              </Table.Row>
            </Table.Header>
            <Table.Body>
              {shipments.map((shipment: any) => (
                <Table.Row key={shipment.id}>
                  <Table.Cell>
                    <Text className="font-medium">{shipment.trackingNumber}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="font-medium">#{shipment.orderDisplayId}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Text className="text-sm">{shipment.customerName}</Text>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color="blue">{shipment.itemsCount}</Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <Badge color={shipment.status === 'shipped' ? "green" : "blue"}>
                      {shipment.status === 'shipped' ? "Expédié" : "Créé"}
                    </Badge>
                  </Table.Cell>
                  <Table.Cell>
                    <div className="flex gap-2">
                      <IconButton
                        variant="transparent"
                        onClick={() => downloadLabel(shipment.labelUrl)}
                        title="Télécharger l'étiquette"
                      >
                        <ArrowDownTray />
                      </IconButton>
                      <IconButton
                        variant="transparent"
                        onClick={() => trackShipment(shipment)}
                        title="Suivre le colis"
                      >
                        <TruckFast />
                      </IconButton>
                    </div>
                  </Table.Cell>
                </Table.Row>
              ))}
            </Table.Body>
          </Table>
        )}
      </div>

      {/* Tracking Modal */}
      <FocusModal open={trackingModalOpen} onOpenChange={setTrackingModalOpen}>
        <FocusModal.Content style={{ backgroundColor: '#1e293b', borderColor: '#475569' }}>
          <FocusModal.Header>
            <div className="flex items-center gap-2">
              <TruckFast className="w-6 h-6" style={{ color: '#60a5fa' }} />
              <Heading level="h2" style={{ color: 'white' }}>
                Suivi de l'expédition {selectedShipment?.trackingNumber}
              </Heading>
            </div>
          </FocusModal.Header>
          <FocusModal.Body style={{ backgroundColor: '#1e293b' }}>
            {trackingLoading ? (
              <Text style={{ color: '#d1d5db' }}>Chargement des informations de suivi...</Text>
            ) : trackingError ? (
              <Text style={{ color: '#f87171' }}>Erreur: {trackingError}</Text>
            ) : trackingDetails && trackingDetails.tracking_events && trackingDetails.tracking_events.length > 0 ? (
              <div className="space-y-4">
                {trackingDetails.tracking_events.map((event, index) => (
                  <div
                    key={index}
                    className="p-4 rounded-lg"
                    style={{ backgroundColor: '#334155' }}
                  >
                    <div className="flex justify-between items-start">
                      <div>
                        <Text className="font-medium" style={{ color: 'white' }}>
                          {event.status}
                        </Text>
                        <Text className="text-sm mt-1" style={{ color: '#d1d5db' }}>
                          {event.location}
                        </Text>
                      </div>
                      <Text className="text-sm" style={{ color: '#9ca3af' }}>
                        {event.date}
                      </Text>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-8">
                <Text className="text-lg font-medium" style={{ color: '#d1d5db' }}>
                  Aucun événement de suivi disponible
                </Text>
              </div>
            )}
          </FocusModal.Body>
          <FocusModal.Footer>
            <Button variant="secondary" onClick={() => setTrackingModalOpen(false)}>
              Fermer
            </Button>
          </FocusModal.Footer>
        </FocusModal.Content>
      </FocusModal>
    </Container>
  )
}

export const config = defineRouteConfig({
  label: "Mondial Relay",
  icon: MapPin,
})

export default MondialRelayPage
