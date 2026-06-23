import type { PrismaClient } from "@prisma/client";

export interface TemplateRecord {
  id: string;
  name: string;
  description: string;
  instructions: string;
  agentType: string;
  fields: Record<string, string | number | boolean>;
  source: string;
  createdAt: Date;
  updatedAt: Date;
}

export class TemplateService {
  constructor(private readonly prisma: PrismaClient) {}

  async list(): Promise<TemplateRecord[]> {
    const rows = await this.prisma.subagentTemplate.findMany({
      orderBy: { name: "asc" },
    });
    return rows.map(this.toRecord);
  }

  async get(id: string): Promise<TemplateRecord | null> {
    const row = await this.prisma.subagentTemplate.findUnique({ where: { id } });
    return row ? this.toRecord(row) : null;
  }

  async create(data: {
    name: string;
    description: string;
    instructions: string;
    agentType?: string;
    fields?: Record<string, string | number | boolean>;
  }): Promise<TemplateRecord> {
    const row = await this.prisma.subagentTemplate.create({
      data: {
        name: data.name,
        description: data.description,
        instructions: data.instructions,
        agentType: data.agentType || "generic",
        fields: JSON.stringify(data.fields || {}),
      },
    });
    return this.toRecord(row);
  }

  async update(
    id: string,
    data: Partial<{
      name: string;
      description: string;
      instructions: string;
      agentType: string;
      fields: Record<string, string | number | boolean>;
    }>
  ): Promise<TemplateRecord> {
    const existing = await this.prisma.subagentTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error(`Template "${id}" not found`);

    const updateData: Record<string, any> = {};
    if (data.name !== undefined) updateData.name = data.name;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.instructions !== undefined) updateData.instructions = data.instructions;
    if (data.agentType !== undefined) updateData.agentType = data.agentType;
    if (data.fields !== undefined) updateData.fields = JSON.stringify(data.fields);

    const row = await this.prisma.subagentTemplate.update({ where: { id }, data: updateData });
    return this.toRecord(row);
  }

  async remove(id: string): Promise<void> {
    const existing = await this.prisma.subagentTemplate.findUnique({ where: { id } });
    if (!existing) throw new Error(`Template "${id}" not found`);
    await this.prisma.subagentTemplate.delete({ where: { id } });
  }

  private toRecord(row: any): TemplateRecord {
    let fields: Record<string, string | number | boolean> = {};
    try {
      fields = JSON.parse(row.fields || "{}");
    } catch {}
    return {
      id: row.id,
      name: row.name,
      description: row.description,
      instructions: row.instructions,
      agentType: row.agentType,
      fields,
      source: row.source,
      createdAt: row.createdAt,
      updatedAt: row.updatedAt,
    };
  }
}
