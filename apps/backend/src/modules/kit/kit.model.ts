import mongoose, { Document, Schema, Types } from 'mongoose';
import { Kit as KitData } from '@zeno/shared';

export type KitStatus = 'generating' | 'completed' | 'failed';

export interface IKit extends Document {
  userId: Types.ObjectId;
  status: KitStatus;
  data?: KitData;
  errorMessage?: string;
  createdAt: Date;
  updatedAt: Date;
}

const KitSchema = new Schema<IKit>(
  {
    userId: {
      type: Schema.Types.ObjectId,
      ref: 'User',
      required: [true, 'User ID is required'],
      index: true,
    },
    status: {
      type: String,
      enum: {
        values: ['generating', 'completed', 'failed'],
        message: '{VALUE} is not a supported status',
      },
      default: 'generating',
    },
    data: {
      type: Schema.Types.Mixed,
      default: null,
    },
    errorMessage: {
      type: String,
      default: null,
    },
  },
  {
    timestamps: true,
  }
);

export const Kit = mongoose.model<IKit>('Kit', KitSchema);
export default Kit;
