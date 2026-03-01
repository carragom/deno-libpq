/**
 * Tests for PostgreSQL notification system
 */

import { assertEquals, assertExists } from '@std/assert'

import { PGURL } from './constants.ts'

import {
	connectdb,
	ConnectionNotifier,
	exec,
	finish,
	getNotificationManager,
	type Notify,
} from './mod.ts'

Deno.test('notification system', async (t) => {
	await t.step('basic notification functionality', async () => {
		// Create two connections - one for listening, one for sending notifications
		const connString = Deno.env.get(PGURL) ?? 'postgresql://localhost'
		const listenerConn = connectdb(connString)
		const senderConn = connectdb(connString)

		try {
			// Create a notifier for the listener connection
			const notifier = new ConnectionNotifier(listenerConn)
			assertExists(notifier)

			// Track received notifications
			const receivedNotifications: Notify[] = []

			// Set up event listeners
			const notificationHandler = (event: Event) => {
				const notificationEvent = event as CustomEvent<Notify>
				const notification = notificationEvent.detail
				receivedNotifications.push(notification)
			}

			// Add event listeners
			notifier.addEventListener('notification', notificationHandler)

			// Check polling status
			const managerStatus = getNotificationManager()
			assertEquals(managerStatus.isPolling, true)
			assertEquals(managerStatus.connectionCount, 1)

			// Set up listener to listen on a test channel
			exec(listenerConn, 'LISTEN test_channel')

			// Wait a moment for polling to start
			await new Promise((resolve) => setTimeout(resolve, 200))

			// Send some test notifications
			exec(senderConn, "NOTIFY test_channel, 'Hello from deno-libpq!'")
			exec(senderConn, "NOTIFY test_channel, 'Second message'")

			// Wait for notifications to be received
			await new Promise((resolve) => setTimeout(resolve, 300))

			// Should have received 2 notifications
			assertEquals(receivedNotifications.length, 2)
			assertEquals(receivedNotifications[0].relname, 'test_channel')
			assertEquals(receivedNotifications[0].extra, 'Hello from deno-libpq!')
			assertEquals(receivedNotifications[1].extra, 'Second message')

			// Test removing listeners
			notifier.removeEventListener('notification', notificationHandler)

			// Send another notification (should not be received after removal)
			exec(senderConn, "NOTIFY test_channel, 'This should not be received'")
			await new Promise((resolve) => setTimeout(resolve, 200))

			// Should still have only 2 notifications
			assertEquals(receivedNotifications.length, 2)

			const finalManagerStatus = getNotificationManager()
			assertEquals(finalManagerStatus.isPolling, false)
			assertEquals(finalManagerStatus.connectionCount, 0)

			// Clean up
			notifier.close()
		} finally {
			// Clean up connections
			try {
				exec(listenerConn, 'UNLISTEN *')
			} catch {
				// Ignore cleanup errors
			}

			finish(listenerConn)
			finish(senderConn)
		}
	})

	await t.step('multiple connection management', async () => {
		const connString = Deno.env.get(PGURL) ?? 'postgresql://localhost'
		const conn1 = connectdb(connString)
		const conn2 = connectdb(connString)
		const conn3 = connectdb(connString)

		try {
			const notifier1 = new ConnectionNotifier(conn1)
			const notifier2 = new ConnectionNotifier(conn2)
			const notifier3 = new ConnectionNotifier(conn3)

			// Add listeners to first two connections
			const handler1 = () => {}
			const handler2 = () => {}

			notifier1.addEventListener('notification', handler1)
			notifier2.addEventListener('notification', handler2)

			await new Promise((resolve) => setTimeout(resolve, 100))

			let status = getNotificationManager()
			assertEquals(status.isPolling, true)
			assertEquals(status.connectionCount, 2)

			// Remove first listener
			notifier1.removeEventListener('notification', handler1)
			await new Promise((resolve) => setTimeout(resolve, 100))

			status = getNotificationManager()
			assertEquals(status.isPolling, true)
			assertEquals(status.connectionCount, 1)

			// Remove second listener
			notifier2.removeEventListener('notification', handler2)
			await new Promise((resolve) => setTimeout(resolve, 100))

			status = getNotificationManager()
			assertEquals(status.isPolling, false)
			assertEquals(status.connectionCount, 0)

			// Clean up
			notifier1.close()
			notifier2.close()
			notifier3.close()
		} finally {
			finish(conn1)
			finish(conn2)
			finish(conn3)
		}
	})
})
