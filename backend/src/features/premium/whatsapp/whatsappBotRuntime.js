import WhatsAppConversation from "./WhatsAppConversation.js";
import {
  deliverWhatsAppBotReply,
} from "./whatsappBotDeliveryService.js";
import {
  getWhatsAppBotConfig,
  processWhatsAppBotMessage,
} from "./whatsappBotOrchestrator.js";


const conversationQueues =
  new Map();


function compactText(
  value,
  maximum = 1000
) {
  return String(value || "")
    .trim()
    .replace(/\s+/g, " ")
    .slice(0, maximum);
}


async function defaultMarkDeliveryFailure({
  conversationId,
  error,
}) {
  await WhatsAppConversation
    .findByIdAndUpdate(
      conversationId,
      {
        $set: {
          "automation.mode":
            "human",
          "automation.handoffRequested":
            true,
          "automation.handoffReason":
            "bot_reply_delivery_failed",
          "automation.lastAction":
            "handoff",
          "automation.lastError":
            compactText(
              error?.message ||
                "WhatsApp bot reply delivery failed.",
              1000
            ),
        },
      },
      {
        runValidators: true,
      }
    );
}


export async function runWhatsAppBotRuntimeMessage(
  item,
  {
    environment =
      process.env,
    processMessage =
      processWhatsAppBotMessage,
    deliverReply =
      deliverWhatsAppBotReply,
    markDeliveryFailure =
      defaultMarkDeliveryFailure,
    now =
      new Date(),
  } = {}
) {
  const config =
    getWhatsAppBotConfig(
      environment
    );

  if (!config.enabled) {
    return {
      processed: false,
      skipped:
        "bot_disabled",
    };
  }

  const result =
    await processMessage(
      item,
      {
        environment,
        now,
      }
    );

  if (
    !result?.processed ||
    !result?.reply
  ) {
    return result;
  }

  if (
    !config.sendReplies
  ) {
    return {
      ...result,
      delivered: false,
      deliverySkipped:
        "reply_disabled",
    };
  }

  try {
    const delivery =
      await deliverReply(
        {
          conversationId:
            item.conversationId,
          body:
            result.reply,
        },
        {
          now,
        }
      );

    return {
      ...result,
      delivered: true,
      delivery:
        delivery?.delivery ||
        null,
      outboundPolicy:
        delivery?.policy ||
        null,
    };
  } catch (error) {
    try {
      await markDeliveryFailure({
        conversationId:
          item.conversationId,
        error,
      });
    } catch {
      /*
       * The original delivery failure remains
       * authoritative. A secondary persistence
       * failure must not trigger another outbound
       * attempt.
       */
    }

    console.error(
      "WhatsApp bot reply delivery failed.",
      {
        conversationId:
          compactText(
            item?.conversationId,
            120
          ),
        code:
          compactText(
            error?.code ||
              error?.name ||
              "WHATSAPP_BOT_DELIVERY_ERROR",
            120
          ),
      }
    );

    return {
      ...result,
      delivered: false,
      deliveryError: true,
      handoff: true,
    };
  }
}


function deferTurn() {
  return new Promise(
    (resolve) => {
      setImmediate(
        resolve
      );
    }
  );
}


export function queueWhatsAppBotMessage(
  item,
  {
    environment =
      process.env,
    run =
      runWhatsAppBotRuntimeMessage,
  } = {}
) {
  const config =
    getWhatsAppBotConfig(
      environment
    );

  if (!config.enabled) {
    return Promise.resolve({
      processed: false,
      skipped:
        "bot_disabled",
    });
  }

  const key =
    compactText(
      item?.conversationId,
      120
    );

  if (!key) {
    return Promise.resolve({
      processed: false,
      skipped:
        "conversation_id_missing",
    });
  }

  const previous =
    conversationQueues
      .get(key) ||
    Promise.resolve();

  const current =
    previous
      .catch(
        () => undefined
      )
      .then(
        deferTurn
      )
      .then(
        () =>
          run(
            item,
            {
              environment,
            }
          )
      );

  conversationQueues.set(
    key,
    current
  );

  const cleanup = () => {
    if (
      conversationQueues
        .get(key) ===
      current
    ) {
      conversationQueues
        .delete(key);
    }
  };

  current.then(
    cleanup,
    (error) => {
      console.error(
        "WhatsApp bot queue item failed.",
        {
          conversationId:
            key,
          code:
            compactText(
              error?.code ||
                error?.name ||
                "WHATSAPP_BOT_QUEUE_ERROR",
              120
            ),
        }
      );

      cleanup();
    }
  );

  return current;
}


export default {
  queueWhatsAppBotMessage,
  runWhatsAppBotRuntimeMessage,
};
