import mongoose from 'mongoose';

const customModuleSchema = new mongoose.Schema(
  {
    name: { type: String, trim: true, required: true },
    slug: { type: String, trim: true, required: true },
    icon: { type: String, trim: true, default: 'Puzzle' },
    description: { type: String, trim: true, default: '' },
    sourceCode: { type: String, required: true },
    status: {
      type: String,
      enum: ['draft', 'published'],
      default: 'draft',
    },
    version: { type: Number, default: 1 },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
  },
  { timestamps: true }
);

customModuleSchema.index({ slug: 1 }, { unique: true });
customModuleSchema.index({ status: 1, updatedAt: -1 });

export const CustomModule = mongoose.model('CustomModule', customModuleSchema);
