import { Controller, Get, Param, Res, NotFoundException } from "@nestjs/common";
import { Response } from "express";
import * as fs from "fs";
import * as path from "path";
import { VENUE_UPLOAD_DIR } from "./admin.service";

// Mekan fotoğrafları herkese açık sunulur (masa kartında gösterilir)
@Controller("media")
export class MediaController {
  @Get("venues/:meetingId/:file")
  venuePhoto(@Param("meetingId") meetingId: string, @Param("file") file: string, @Res() res: Response) {
    // Sadece beklenen ad biçimi — dizin dışına çıkılamaz
    if (!/^[a-z0-9]+$/i.test(meetingId) || !/^photo[1-3]-\d+\.(jpg|png|webp)$/.test(file)) {
      throw new NotFoundException();
    }
    const filePath = path.join(VENUE_UPLOAD_DIR, meetingId, file);
    if (!fs.existsSync(filePath)) throw new NotFoundException();
    res.set("Cache-Control", "public, max-age=86400");
    return res.sendFile(filePath);
  }
}
