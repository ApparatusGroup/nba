import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db/prisma";
import {
  evaluateAiTradeAcceptance,
  validateSalaryCapTrade,
} from "@/lib/gm/logic";
import { getLeagueStateOrThrow, getTeamPayroll, resolveUserTeamId } from "@/lib/league/core";

export const runtime = "nodejs";

const tradeSchema = z.object({
  partnerTeamId: z.string().min(1),
  sendPlayerIds: z.array(z.string()).min(1),
  receivePlayerIds: z.array(z.string()).min(1),
});

export async function POST(request: Request) {
  try {
    const body = await request.json();
    const parsed = tradeSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 });
    }

    const { partnerTeamId, sendPlayerIds, receivePlayerIds } = parsed.data;

    const leagueState = await getLeagueStateOrThrow();
    const userTeamId = leagueState.userTeamId ?? (await resolveUserTeamId());

    if (partnerTeamId === userTeamId) {
      return NextResponse.json({ error: "Cannot trade with your own team." }, { status: 400 });
    }

    const allPlayerIds = [...new Set([...sendPlayerIds, ...receivePlayerIds])];

    const players = await prisma.player.findMany({
      where: { id: { in: allPlayerIds } },
      include: { contract: true },
    });

    const userOutgoing = players.filter(
      (player) => sendPlayerIds.includes(player.id) && player.teamId === userTeamId,
    );
    const aiOutgoing = players.filter(
      (player) => receivePlayerIds.includes(player.id) && player.teamId === partnerTeamId,
    );

    if (userOutgoing.length !== sendPlayerIds.length || aiOutgoing.length !== receivePlayerIds.length) {
      return NextResponse.json({ error: "One or more selected players are invalid." }, { status: 400 });
    }

    const userPayroll = await getTeamPayroll(userTeamId);
    const aiPayroll = await getTeamPayroll(partnerTeamId);

    const userOutgoingSalary = userOutgoing.reduce((sum, player) => sum + (player.contract?.amount ?? 0), 0);
    const userIncomingSalary = aiOutgoing.reduce((sum, player) => sum + (player.contract?.amount ?? 0), 0);
    const aiOutgoingSalary = userIncomingSalary;
    const aiIncomingSalary = userOutgoingSalary;

    const capValidation = validateSalaryCapTrade(
      {
        payroll: userPayroll,
        outgoingSalary: userOutgoingSalary,
        incomingSalary: userIncomingSalary,
      },
      {
        payroll: aiPayroll,
        outgoingSalary: aiOutgoingSalary,
        incomingSalary: aiIncomingSalary,
      },
    );

    if (!capValidation.isValid) {
      return NextResponse.json(
        {
          accepted: false,
          reason: capValidation.reasons.join(" "),
        },
        { status: 400 },
      );
    }

    const aiDecision = evaluateAiTradeAcceptance(
      aiOutgoing.map((player) => ({ player, contract: player.contract })),
      userOutgoing.map((player) => ({ player, contract: player.contract })),
    );

    if (!aiDecision.accepted) {
      return NextResponse.json({
        accepted: false,
        reason: `AI declined: value in ${aiDecision.aiIncomingValue}, value out ${aiDecision.aiOutgoingValue}.`,
      });
    }

    await prisma.$transaction([
      prisma.player.updateMany({
        where: { id: { in: sendPlayerIds } },
        data: { teamId: partnerTeamId },
      }),
      prisma.player.updateMany({
        where: { id: { in: receivePlayerIds } },
        data: { teamId: userTeamId },
      }),
    ]);

    return NextResponse.json({
      accepted: true,
      message: "Trade accepted and executed.",
      aiIncomingValue: aiDecision.aiIncomingValue,
      aiOutgoingValue: aiDecision.aiOutgoingValue,
      salaryDelta: userIncomingSalary - userOutgoingSalary,
    });
  } catch (error) {
    return NextResponse.json(
      {
        error: error instanceof Error ? error.message : "Unable to process trade.",
      },
      { status: 500 },
    );
  }
}
