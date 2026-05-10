import { getBuildingHours, initializeDefaultBuildingHours } from "@/server/db/building-hours-repository";

export async function GET() {
  try {
    await initializeDefaultBuildingHours();
    const hours = await getBuildingHours();
    return Response.json(hours);
  } catch (error) {
    console.error("Failed to get building hours:", error);
    return Response.json(
      { error: "Failed to get building hours" },
      { status: 500 },
    );
  }
}