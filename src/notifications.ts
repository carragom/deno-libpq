import { consumeInput, notifies } from './database.ts'
import type { Notify, PGconn } from './ffi.ts'
import { ConnStatusType, ffi } from './ffi.ts'

/**
 * Custom event type for PostgreSQL notifications
 */
export class NotificationEvent extends CustomEvent<Notify> {
	constructor(notification: Notify) {
		super('notification', { detail: notification })
	}
}

/**
 * Custom event type for connection close events
 */
export class ConnectionCloseEvent extends CustomEvent<void> {
	constructor() {
		super('close')
	}
}

/**
 * EventTarget-based notifier for a specific PostgreSQL connection
 * Provides real-time notification events via polling
 */
export class ConnectionNotifier extends EventTarget {
	private subscribers = 0

	constructor(private conn: PGconn) {
		super()
	}

	/**
	 * Add event listener and automatically start polling if this is the first subscriber
	 */
	override addEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | AddEventListenerOptions,
	): void {
		super.addEventListener(type, listener, options)

		if (type === 'notification') {
			this.subscribers++
			if (this.subscribers === 1) {
				notificationManager.register(this.conn, this)
			}
		}
	}

	/**
	 * Remove event listener and automatically stop polling if no subscribers remain
	 */
	override removeEventListener(
		type: string,
		listener: EventListenerOrEventListenerObject | null,
		options?: boolean | EventListenerOptions,
	): void {
		super.removeEventListener(type, listener, options)

		if (type === 'notification') {
			this.subscribers--
			if (this.subscribers <= 0) {
				this.subscribers = 0
				notificationManager.unregister(this.conn)
			}
		}
	}

	/**
	 * Manually close the notifier and clean up resources
	 */
	close(): void {
		notificationManager.unregister(this.conn)
		this.dispatchEvent(new ConnectionCloseEvent())
	}

	/**
	 * Get the underlying PostgreSQL connection
	 */
	get connection(): PGconn {
		return this.conn
	}

	/**
	 * Check if this notifier has active subscribers
	 */
	get hasSubscribers(): boolean {
		return this.subscribers > 0
	}
}

/**
 * Singleton manager for coordinating notification polling across all connections
 */
class NotificationManager {
	private connections = new Map<PGconn, ConnectionNotifier>()
	private pollingTimer: number | null = null
	private readonly POLL_INTERVAL = 100 // milliseconds

	/**
	 * Register a connection for notification polling
	 */
	register(conn: PGconn, notifier: ConnectionNotifier): void {
		this.connections.set(conn, notifier)
		this.startPollingIfNeeded()
	}

	/**
	 * Unregister a connection from notification polling
	 */
	unregister(conn: PGconn): void {
		this.connections.delete(conn)
		this.stopPollingIfEmpty()
	}

	/**
	 * Start the polling timer if not already running
	 */
	private startPollingIfNeeded(): void {
		if (this.pollingTimer === null && this.connections.size > 0) {
			this.pollingTimer = setInterval(() => {
				this.poll()
			}, this.POLL_INTERVAL)
		}
	}

	/**
	 * Stop the polling timer if no connections remain
	 */
	private stopPollingIfEmpty(): void {
		if (this.connections.size === 0 && this.pollingTimer !== null) {
			clearInterval(this.pollingTimer)
			this.pollingTimer = null
		}
	}

	/**
	 * Poll all registered connections for notifications
	 */
	private poll(): void {
		const closedConnections: PGconn[] = []

		for (const [conn, notifier] of this.connections) {
			if (this.isConnectionValid(conn)) {
				this.checkNotifications(conn, notifier)
			} else {
				closedConnections.push(conn)
			}
		}

		// Clean up closed connections
		for (const conn of closedConnections) {
			this.handleClosedConnection(conn)
		}
	}

	/**
	 * Check if a connection is still valid
	 */
	private isConnectionValid(conn: PGconn): boolean {
		try {
			const status = ffi.PQstatus(conn)
			return status === ConnStatusType.CONNECTION_OK
		} catch {
			return false
		}
	}

	/**
	 * Check for notifications on a specific connection
	 */
	private checkNotifications(
		conn: PGconn,
		notifier: ConnectionNotifier,
	): void {
		// Consume any pending input from the server
		consumeInput(conn)

		// Check for notifications
		let notification: Notify | null
		while ((notification = notifies(conn)) !== null) {
			notifier.dispatchEvent(new NotificationEvent(notification))
		}
	}

	/**
	 * Handle a closed connection by cleaning up and notifying subscribers
	 */
	private handleClosedConnection(conn: PGconn): void {
		const notifier = this.connections.get(conn)
		if (notifier) {
			notifier.dispatchEvent(new ConnectionCloseEvent())
			this.unregister(conn)
		}
	}

	/**
	 * Get current polling status for debugging
	 */
	get isPolling(): boolean {
		return this.pollingTimer !== null
	}

	/**
	 * Get number of active connections being polled
	 */
	get connectionCount(): number {
		return this.connections.size
	}
}

// Singleton instance
const notificationManager = new NotificationManager()

/**
 * Get the global notification manager instance (for debugging)
 * @returns {NotificationManager} The singleton notification manager
 */
export function getNotificationManager(): {
	isPolling: boolean
	connectionCount: number
} {
	return {
		isPolling: notificationManager.isPolling,
		connectionCount: notificationManager.connectionCount,
	}
}
