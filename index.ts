import { readFileSync } from "fs";
import nodeFetch from "node-fetch";
import * as YAML from "yaml";
import { parseStringPromise } from "xml2js";
import * as chalk from "chalk";
import { Agent } from "https";
import {
  toDate,
  format,
  formatDistanceToNow,
  differenceInDays
} from "date-fns";
import { uniq } from "lodash";

const config = readFileSync("./tracking.yml");
const trackingConfig = YAML.parse(config.toString());

class Tracker {
  public zip: string | number;
  public uspsConfig: IUSPSConfig;
  public tracked: ITracked[] = [];
  public annotations: IAnnotations;
  constructor(trackingConfig: ITrackingConfig) {
    console.log(
      `${chalk.whiteBright(chalk.bold(chalk.bgGray("Shiptrack starting...")))}`
    );
    console.log("");
    this.zip = trackingConfig.zip;
    this.uspsConfig = {
      apiBase: trackingConfig.usps.apiBase,
      app: trackingConfig.usps.app,
      ip: trackingConfig.usps.ip,
      username: trackingConfig.usps.username
    };
    this.annotations = trackingConfig.annotations;
    this.track();
  }
  async track() {
    await this.trackUsps(trackingConfig.usps.tracking);
    this.logToday();
    this.tracked.forEach(this.log);
  }
  private getUspsDeliveryDateField(info: IUSPSTracking): string {
    return ["PredictedDeliveryDate", "ExpectedDeliveryDate"].find(date =>
      Array.isArray(info[date]) ? true : null
    );
  }
  public trackUsps = async (trackingNumbers = []): Promise<void> => {
    const agent = new Agent({
      rejectUnauthorized: false
    });
    const xml = `<?xml version="1.0" encoding="UTF-8" ?>
        <TrackFieldRequest USERID="${this.uspsConfig.username}">
        <Revision>1</Revision>
        <ClientIp>${this.uspsConfig.ip}</ClientIp>
        <SourceId>${this.uspsConfig.app}</SourceId>
        ${trackingNumbers
          .map(
            trackingNumber =>
              `<TrackID ID="${trackingNumber}"><DestinationZipCode>${this.zip}</DestinationZipCode></TrackID>`
          )
          .join(`\n`)}
        </TrackFieldRequest>`;
    // console.log(this.uspsConfig);
    const uri = `${this.uspsConfig.apiBase}?API=TrackV2&XML=${xml}`;
    const resp = await nodeFetch(uri, {});
    const text = await resp.text();

    const result = await parseStringPromise(text);
    // console.log(JSON.stringify(result, null, 2));
    if (result.TrackResponse && Array.isArray(result.TrackResponse.TrackInfo)) {
      result.TrackResponse.TrackInfo.sort((a, b) => {
        const date_a = a[this.getUspsDeliveryDateField(a)]
          ? Date.parse(a[this.getUspsDeliveryDateField(a)])
          : Number.POSITIVE_INFINITY;
        const date_b = b[this.getUspsDeliveryDateField(b)]
          ? Date.parse(b[this.getUspsDeliveryDateField(b)])
          : Number.POSITIVE_INFINITY;
        return date_a > date_b ? 1 : date_a === date_b ? 0 : -1;
      }).forEach(this.commitUsps);
    }
  };
  private commitUsps = (info: IUSPSTracking): void => {
    const trackingNumber = info.$.ID;
    const trackingClass = info.Class.join(", ");
    const expectedDate = info.ExpectedDeliveryDate
      ? info.ExpectedDeliveryDate.join(", ")
      : "";
    const predictedDate = info.PredictedDeliveryDate
      ? info.PredictedDeliveryDate.join(", ")
      : "";
    const statusSummary = info.StatusSummary.join(", ");
    const statusCategory = info.StatusCategory.join(", ");
    const origin =
      info.OriginState && info.OriginCity
        ? `${info.OriginCity.join(", ")}, ${info.OriginState.join(", ")}`
        : null;
    this.tracked.push({
      service: "USPS",
      trackingNumber,
      trackingClass,
      expectedDate,
      predictedDate,
      statusSummary,
      statusCategory,
      origin,
      annotation: this.annotations[trackingNumber] || null
    });
  };
  private dateIsToday(expectedDate) {
    const dateFormat = "yyyy-MM-dd";
    const today = format(new Date(), dateFormat);
    return !Number.isNaN(Date.parse(expectedDate))
      ? format(toDate(Date.parse(expectedDate)), dateFormat) === today
      : false;
  }
  public logToday = (): void => {
    const arrivingToday = this.tracked.filter(t =>
      this.dateIsToday(t.expectedDate)
    );
    if (arrivingToday.length) {
      console.log(
        chalk.bold(
          `There are ${
            arrivingToday.length
          } package(s) arriving today from ${uniq(
            arrivingToday.map(({ service }) => service)
          ).join(", ")}`
        )
      );
      console.log("");
    }
  };
  public log = (info: ITracked): void => {
    const LOG_LEFT_SIZE = 20;
    const LOG_MID_SIZE = 30;
    const expected = info.expectedDate
      ? this.dateIsToday(info.expectedDate)
        ? "Expected today"
        : `Expected ${info.expectedDate}`
      : "";
    const predicted = info.predictedDate
      ? this.dateIsToday(info.predictedDate)
        ? "Predicted today"
        : `Predicted ${info.predictedDate}`
      : "";
    console.log(
      `${info.statusCategory.padEnd(LOG_LEFT_SIZE)} ${chalk.bold(
        info.trackingNumber.padEnd(LOG_MID_SIZE)
      )} ${`${info.service}, ${info.trackingClass.replace(
        /\<.+\>/gi,
        ""
      )}`.padEnd(30)} ${chalk.blue(
        info.statusCategory === "Delivered"
          ? ""
          : `${predicted ? predicted : expected}`
      )}`
    );
    if (info.origin) {
      console.log(
        `${chalk.green(`${info.origin}`.padEnd(LOG_LEFT_SIZE))} ${
          info.annotation
            ? `${chalk.blackBright(
                info.annotation.sender || "Unspecified sender"
              )} ${
                info.annotation.description
                  ? `- ${chalk.grey(info.annotation.description || "")}`
                  : ""
              }`
            : ""
        }`
      );
    }
    console.log(`${chalk.dim(info.statusSummary)}\n`);
  };
}
``;

new Tracker(trackingConfig);

interface IUSPSTracking {
  $: {
    ID: string;
  };
  Class?: string[];
  ExpectedDeliveryDate?: string[];
  PredictedDeliveryDate?: string[];
  StatusSummary?: string[];
  OriginCity?: string[];
  OriginState?: string[];
  StatusCategory?: string[];
}
interface IUSPSConfig {
  apiBase: string;
  app: string;
  ip: string;
  username: string;
}
interface ITrackingConfig {
  zip: number | string;
  usps: ITrackingUSPSConfig;
  annotations: IAnnotations;
}
interface ITrackingUSPSConfig {
  apiBase: string;
  app: string;
  ip: string;
  username: string;
  tracking: string[];
}

interface ITracked {
  service: "USPS" | "Fedex" | "DHL" | "UPS";
  statusCategory: "Delivered" | string;
  trackingNumber: string;
  trackingClass: string;
  expectedDate: string;
  predictedDate: string;
  statusSummary: string;
  origin: string;
  annotation?: IAnnotation;
}

interface IAnnotations {
  [key: string]: IAnnotation;
}

interface IAnnotation {
  sender?: string;
  description?: string;
}
