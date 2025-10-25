require('colors');

// Import SSE function (will be set by route initialization)
let sendSSENotification = null;

class NotificationService {
  constructor() {
    this.channels = {
      console: true,
      email: process.env.EMAIL_ENABLED === 'true',
      sms: process.env.SMS_ENABLED === 'true',
      push: process.env.PUSH_ENABLED === 'true',
      sse: process.env.SSE_ENABLED !== 'false'  // Enable SSE by default
    };
    
    this.templates = {
      orderCreated: {
        title: '🎉 Pedido Confirmado',
        subject: 'Tu pedido ha sido confirmado'
      },
      orderConfirmed: {
        title: '✅ Pedido en Preparación',
        subject: 'Tu pedido está siendo preparado'
      },
      orderPreparing: {
        title: '👨‍🍳 Preparando tu Pedido',
        subject: 'Tu pedido está en preparación'
      },
      orderOutForDelivery: {
        title: '🚚 Pedido en Camino',
        subject: 'Tu pedido está en camino'
      },
      orderDelivered: {
        title: '✅ Pedido Entregado',
        subject: 'Tu pedido ha sido entregado'
      },
      orderCancelled: {
        title: '❌ Pedido Cancelado',
        subject: 'Tu pedido ha sido cancelado'
      }
    };

    this.stats = {
      sent: 0,
      failed: 0,
      byChannel: {
        console: { sent: 0, failed: 0 },
        email: { sent: 0, failed: 0 },
        sms: { sent: 0, failed: 0 },
        push: { sent: 0, failed: 0 },
        sse: { sent: 0, failed: 0 }
      }
    };
  }

  async sendOrderCreatedNotification(orderData) {
    const { orderId, userId, totalAmount, items, deliveryAddress } = orderData;
    
    const message = this.formatOrderCreatedMessage({
      orderId,
      userId,
      totalAmount,
      items,
      deliveryAddress
    });

    return await this.sendNotification('orderCreated', message, { userId });
  }

  async sendOrderStatusUpdatedNotification(orderData) {
    const { orderId, userId, currentStatus, previousStatus, totalAmount } = orderData;
    
    const message = this.formatOrderStatusMessage({
      orderId,
      userId,
      currentStatus,
      previousStatus,
      totalAmount
    });

    const templateKey = this.getTemplateKeyForStatus(currentStatus);
    return await this.sendNotification(templateKey, message, { userId });
  }

  formatOrderCreatedMessage({ orderId, userId, totalAmount, items, deliveryAddress }) {
    const itemsList = items.map(item => 
      `  • ${item.quantity}x ${item.product_name} - $${item.price}`
    ).join('\n');

    return {
      title: '🎉 ¡Nuevo Pedido Confirmado!',
      body: `
📋 Pedido: ${orderId}
👤 Usuario: ${userId}
💰 Total: $${totalAmount}

🛒 Items:
${itemsList}

📍 Dirección de entrega:
${deliveryAddress.street}
${deliveryAddress.city}, ${deliveryAddress.postal_code}
${deliveryAddress.phone ? `📞 ${deliveryAddress.phone}` : ''}

¡Gracias por tu pedido! Te mantendremos informado del progreso.
      `.trim(),
      metadata: {
        orderId,
        userId,
        type: 'order_created'
      }
    };
  }

  formatOrderStatusMessage({ orderId, userId, currentStatus, previousStatus, totalAmount }) {
    const statusMessages = {
      confirmed: '✅ Tu pedido ha sido confirmado y se está procesando.',
      preparing: '👨‍🍳 ¡Estamos preparando tu delicioso pedido!',
      out_for_delivery: '🚚 Tu pedido está en camino. ¡Prepárate para recibirlo!',
      delivered: '🎉 ¡Tu pedido ha sido entregado! Esperamos que lo disfrutes.',
      cancelled: '❌ Tu pedido ha sido cancelado. Si tienes preguntas, contáctanos.'
    };

    const statusEmojis = {
      confirmed: '✅',
      preparing: '👨‍🍳',
      out_for_delivery: '🚚',
      delivered: '🎉',
      cancelled: '❌'
    };

    return {
      title: `${statusEmojis[currentStatus]} Estado del Pedido Actualizado`,
      body: `
📋 Pedido: ${orderId}
👤 Usuario: ${userId}
💰 Total: $${totalAmount}

📈 Estado: ${previousStatus} ➜ ${currentStatus}

${statusMessages[currentStatus]}

¡Gracias por elegir nuestro servicio!
      `.trim(),
      metadata: {
        orderId,
        userId,
        currentStatus,
        previousStatus,
        type: 'order_status_updated'
      }
    };
  }

  async sendNotification(templateKey, message, options = {}) {
    const template = this.templates[templateKey];
    if (!template) {
      console.error(`❌ Unknown template: ${templateKey}`.red);
      return false;
    }

    const results = [];
    let allSuccessful = true;

    // Send via enabled channels
    for (const [channel, enabled] of Object.entries(this.channels)) {
      if (enabled) {
        try {
          const success = await this.sendViaChannel(channel, template, message, options);
          results.push({ channel, success });
          
          if (success) {
            this.stats.byChannel[channel].sent++;
          } else {
            this.stats.byChannel[channel].failed++;
            allSuccessful = false;
          }
        } catch (error) {
          console.error(`❌ Error sending via ${channel}:`.red, error);
          results.push({ channel, success: false, error: error.message });
          this.stats.byChannel[channel].failed++;
          allSuccessful = false;
        }
      }
    }

    // Update overall stats
    if (allSuccessful) {
      this.stats.sent++;
    } else {
      this.stats.failed++;
    }

    return { success: allSuccessful, results };
  }

  async sendViaChannel(channel, template, message, options) {
    switch (channel) {
      case 'console':
        return this.sendConsoleNotification(template, message, options);
      case 'email':
        return this.sendEmailNotification(template, message, options);
      case 'sms':
        return this.sendSMSNotification(template, message, options);
      case 'push':
        return this.sendPushNotification(template, message, options);
      case 'sse':
        return this.sendSSENotification(template, message, options);
      default:
        console.error(`❌ Unknown notification channel: ${channel}`.red);
        return false;
    }
  }

  async sendConsoleNotification(template, message, options) {
    try {
      console.log('\n' + '='.repeat(60).cyan);
      console.log(`📩 ${template.title}`.cyan.bold);
      console.log('='.repeat(60).cyan);
      
      if (options.userId) {
        console.log(`👤 Usuario: ${options.userId}`.yellow);
      }
      
      console.log(`📧 ${template.subject}`.green);
      console.log('');
      console.log(message.body.white);
      console.log('');
      console.log(`⏰ ${new Date().toLocaleString()}`.gray);
      console.log('='.repeat(60).cyan + '\n');
      
      return true;
    } catch (error) {
      console.error('❌ Console notification failed:'.red, error);
      return false;
    }
  }

  async sendEmailNotification(template, message, options) {
    // Simulated email sending
    try {
      console.log(`📧 [EMAIL] Sending to user ${options.userId}: ${template.subject}`.blue);
      
      // Simulate email sending delay
      await new Promise(resolve => setTimeout(resolve, 100));
      
      console.log(`✅ [EMAIL] Sent successfully to user ${options.userId}`.green);
      return true;
    } catch (error) {
      console.error('❌ Email notification failed:'.red, error);
      return false;
    }
  }

  async sendSMSNotification(template, message, options) {
    // Simulated SMS sending
    try {
      console.log(`📱 [SMS] Sending to user ${options.userId}: ${template.title}`.magenta);
      
      // Simulate SMS sending delay
      await new Promise(resolve => setTimeout(resolve, 50));
      
      console.log(`✅ [SMS] Sent successfully to user ${options.userId}`.green);
      return true;
    } catch (error) {
      console.error('❌ SMS notification failed:'.red, error);
      return false;
    }
  }

  async sendPushNotification(template, message, options) {
    // Simulated push notification
    try {
      console.log(`🔔 [PUSH] Sending to user ${options.userId}: ${template.title}`.cyan);
      
      // Simulate push notification delay
      await new Promise(resolve => setTimeout(resolve, 25));
      
      console.log(`✅ [PUSH] Sent successfully to user ${options.userId}`.green);
      return true;
    } catch (error) {
      console.error('❌ Push notification failed:'.red, error);
      return false;
    }
  }

  async sendSSENotification(template, message, options) {
    try {
      if (!sendSSENotification) {
        console.log('⚠️  [SSE] SSE function not initialized, skipping SSE notification'.yellow);
        return false;
      }

      console.log(`📡 [SSE] Sending to user ${options.userId}: ${template.title}`.blue);

      const ssePayload = {
        template: template,
        message: message,
        metadata: {
          userId: options.userId,
          timestamp: new Date().toISOString(),
          channel: 'sse'
        }
      };

      const result = sendSSENotification(options.userId, ssePayload);

      if (result.sent > 0) {
        console.log(`✅ [SSE] Sent to ${result.sent} client(s) for user ${options.userId}`.green);
        return true;
      } else {
        console.log(`⚠️  [SSE] No active connections found for user ${options.userId}`.yellow);
        return false;
      }
    } catch (error) {
      console.error('❌ SSE notification failed:'.red, error);
      return false;
    }
  }

  getTemplateKeyForStatus(status) {
    const statusMap = {
      'confirmed': 'orderConfirmed',
      'preparing': 'orderPreparing',
      'out_for_delivery': 'orderOutForDelivery',
      'delivered': 'orderDelivered',
      'cancelled': 'orderCancelled'
    };
    
    return statusMap[status] || 'orderCreated';
  }

  getStats() {
    return {
      ...this.stats,
      activeChannels: Object.entries(this.channels)
        .filter(([, enabled]) => enabled)
        .map(([channel]) => channel),
      timestamp: new Date().toISOString()
    };
  }

  resetStats() {
    this.stats = {
      sent: 0,
      failed: 0,
      byChannel: {
        console: { sent: 0, failed: 0 },
        email: { sent: 0, failed: 0 },
        sms: { sent: 0, failed: 0 },
        push: { sent: 0, failed: 0 },
        sse: { sent: 0, failed: 0 }
      }
    };
  }

  setChannelEnabled(channel, enabled) {
    if (this.channels.hasOwnProperty(channel)) {
      this.channels[channel] = enabled;
      console.log(`🔧 Channel ${channel} ${enabled ? 'enabled' : 'disabled'}`.yellow);
    } else {
      console.error(`❌ Unknown channel: ${channel}`.red);
    }
  }

  // Method to initialize SSE function from routes
  initializeSSE(sseFunction) {
    sendSSENotification = sseFunction;
    console.log('📡 SSE notification system initialized'.green);
  }
}

// Export singleton instance
module.exports = new NotificationService();