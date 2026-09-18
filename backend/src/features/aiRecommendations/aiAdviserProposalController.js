import {
  createAdviserActionProposal,
  listAdviserActionProposals,
  reviewAdviserActionProposal,
} from "./aiAdviserProposalService.js";

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

export async function createProposal(
  request,
  response
) {
  const proposal =
    await createAdviserActionProposal({
      ...request.body,
      user:
        request.user,
      requestId:
        requestId(
          request
        ),
    });

  return response
    .status(201)
    .json({
      success: true,
      proposal,
      execution: {
        automatic:
          false,
        message:
          "This records a proposed action for human review. It does not execute the underlying business change.",
      },
    });
}

export async function listProposals(
  request,
  response
) {
  const proposals =
    await listAdviserActionProposals({
      user:
        request.user,
      status:
        request.query
          ?.status,
      limit:
        request.query
          ?.limit,
    });

  return response.json({
    success: true,
    proposals,
  });
}

export async function reviewProposal(
  request,
  response
) {
  const proposal =
    await reviewAdviserActionProposal({
      proposalId:
        request.params
          .proposalId,
      decision:
        request.body
          ?.decision,
      note:
        request.body
          ?.note,
      user:
        request.user,
      requestId:
        requestId(
          request
        ),
    });

  return response.json({
    success: true,
    proposal,
    execution: {
      automatic:
        false,
      message:
        proposal.status ===
        "approved"
          ? "Approval is recorded. The underlying change must still be completed through its governed SalonAI workflow."
          : "The proposal was rejected and will not be executed.",
    },
  });
}

export default {
  createProposal,
  listProposals,
  reviewProposal,
};
