import React, { useState } from "react";
import { Batch, User } from "@/entities/all";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PlusCircle } from "lucide-react";

export default function CreateBatchModal({ isOpen, onClose, onBatchCreated }) {
  const [batchName, setBatchName] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const handleCreate = async () => {
    if (!batchName) return;
    setIsSaving(true);
    try {
      const user = await User.me();
      const newBatch = {
        batch_name: batchName,
        batch_description: "Private batch for specialized training.",
        batch_type: "private",
        batch_id: `private_${Date.now()}`,
        student_count: 0,
        created_by: user.email,
      };
      await Batch.create(newBatch);
      onBatchCreated();
      onClose();
    } catch (error) {
      console.error("Failed to create private batch", error);
    } finally {
      setIsSaving(false);
      setBatchName("");
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <PlusCircle className="w-6 h-6" /> Create Private Batch
          </DialogTitle>
          <DialogDescription>
            Create a private batch for workshops or specialized classes.
          </DialogDescription>
        </DialogHeader>
        <div className="py-4">
          <Label htmlFor="batch-name">Batch Name</Label>
          <Input
            id="batch-name"
            placeholder="e.g., Rehan Sir JDBC Batch"
            value={batchName}
            onChange={(e) => setBatchName(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={handleCreate} disabled={isSaving || !batchName}>
            {isSaving ? "Creating..." : "Create Batch"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}