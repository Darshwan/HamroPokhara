package sse

import (
	"encoding/json"
	"log"
	"sync"
)

// Broker manages Server-Sent Events connections.
// The Ministry Dashboard connects here for live feed.
type Broker struct {
	mu      sync.RWMutex
	clients map[chan []byte]struct{}
}

func NewBroker() *Broker {
	return &Broker{
		clients: make(map[chan []byte]struct{}),
	}
}

// Subscribe registers a new client channel.
// Returns a channel that receives JSON event data.
func (b *Broker) Subscribe() chan []byte {
	ch := make(chan []byte, 10) // buffered — don't block on slow clients
	b.mu.Lock()
	b.clients[ch] = struct{}{}
	b.mu.Unlock()
	log.Printf("SSE client connected. Total: %d", b.ClientCount())
	return ch
}

// Unsubscribe removes a client channel.
func (b *Broker) Unsubscribe(ch chan []byte) {
	b.mu.Lock()
	delete(b.clients, ch)
	close(ch)
	b.mu.Unlock()
	log.Printf("SSE client disconnected. Total: %d", b.ClientCount())
}

// Publish sends an event to ALL connected clients.
// Called whenever a document is approved.
func (b *Broker) Publish(eventType string, payload interface{}) {
	data, err := json.Marshal(map[string]interface{}{
		"type":    eventType,
		"payload": payload,
	})
	if err != nil {
		log.Printf("SSE marshal error: %v", err)
		return
	}

	b.mu.RLock()
	defer b.mu.RUnlock()

	for ch := range b.clients {
		select {
		case ch <- data:
		default:
			// Client is too slow — skip this event for them
			// Don't block the entire broadcast
		}
	}
}

func (b *Broker) ClientCount() int {
	b.mu.RLock()
	defer b.mu.RUnlock()
	return len(b.clients)
}
