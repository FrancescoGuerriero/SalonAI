import {
  prepareApprovedAdviserProposal,
} from "./aiAdviserProposalPreparationService.js";

function requestId(
  request
) {
  return (
    request.id ||
    request.requestId ||
    request.headers?.[
      "x-request-id"
    ] ||
    ""
  );
}

export async function prepareProposalDraft(
  request,
  response
) {
  const result =
    await prepareApprovedAdviserProposal({
      proposalId:
        request.params
          .proposalId,
      user:
        request.user,
      requestId:
        requestId(
          request
        ),
    });

  return response.json({
    success: true,
    ...result,
    execution: {
      automatic:
        false,
      deliveryTriggered:
        false,
      message:
        "SalonAI prepared a draft only. Review and explicitly schedule or launch it through the normal communications workflow.",
    },
  });
}

export default {
  prepareProposalDraft,
};
