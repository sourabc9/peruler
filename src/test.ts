import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import * as moment from 'moment';

@Injectable()
export class EligibilityService {
    private readonly STORE_MATCH_QUERY_V120 = '...'; // Your query here
    private readonly driver = ...; // Your database driver instance or repository

    async checkEligibilityV120(fact): Promise<any> {
        const requestTimeStamp = new Date();
        const deliveryType = fact.jsonRequest.requestPayloadData.additionalData.deliveryVendor?.trim()?.toLowerCase() || "";
        const storeNumber = fact.jsonRequest.requestPayloadData.additionalData.storeNumber || '';

        try {
            const result = await this.driver.execute(this.STORE_MATCH_QUERY_V120, [storeNumber, deliveryType], {
                executionProfile: 'readTimeout30s'
            });
            return result.rows;
        } catch (error) {
            throw new NotFoundException(error.message);
        }
    }

    async storeExclusionRuleV120(fact, resOBJ): Promise<any> {
        const currentTimeStamp = fact.jsonRequest.requestPayloadData.additionalData.currentTimeStamp || '';
        const parResponse = {
            ruleNm: fact.ruleName,
            ruleDesc: fact.ruleDesc,
            version: fact.version,
            ruleDecision: 'PASS',
            rData: [{
                "key": fact.ruleName,
                "value": "Y",
                "dispositionCode": "0000",
                "dispositionDescription": ""
            }]
        };

        resOBJ.result.storeEligibility = 'Y';
        resOBJ.flag = false;

        const response = await this.checkEligibilityV120(fact);
        if (response && response.length) {
            const exclEndDt = moment(response[0].exclusion_end_dt, "YYYYMMDDHHmmssSSSSSS").format('YYYY-MM-DD HH:mm:ss');
            const exclStartDt = moment(response[0].exclusion_start_dt, "YYYYMMDDHHmmssSSSSSS").format('YYYY-MM-DD HH:mm:ss');
            if ((response[0].exclusion_start_dt == null && response[0].exclusion_end_dt == null) || (currentTimeStamp >= exclStartDt && currentTimeStamp < exclEndDt) || (response[0].exclusion_start_dt == null && currentTimeStamp < exclEndDt) || (response[0].exclusion_end_dt == null && currentTimeStamp >= exclStartDt)) {
                resOBJ.result.storeEligibility = 'N';
                resOBJ.flag = true;
                resOBJ.result.dispositionCode.push(fact.ruleData[0].dispositionCode);
                resOBJ.result.dispositionDescription.push(fact.ruleData[0].dispositionDescription);
            }
        }

        if (fact.condition === 'PARALLEL') {
            return parResponse;
        } else {
            return resOBJ;
        }
    }

    async mainFunction(resOBJ): Promise<any> {
        const requestTimeStamp = new Date();
        const fact = {
            rule: this.ruleData,
            jsonRequest: this.jsonRequest,
            storeList: utils.convertFromKeyValueToObject(this.ruleData.ruleData),
            ruleData: this.ruleData.ruleData,
            storeNumber: this.jsonRequest.requestPayloadData.additionalData.storeNumber,
            ruleName: this.ruleData.ruleName,
            ruleDesc: this.ruleData.ruleDesc,
            version: this.ruleData.version,
            condition: this.condition
        };

        if (fact.version === '1.2.0') {
            const result = await this.storeExclusionRuleV120(fact, resOBJ);
            // logger logic here
            return result.flag ? result : null;
        } else if (fact.version === '1.4.0') {
            // logic for version 1.4.0
        } else {
            // logger logic here
            throw new BadRequestException('INVALID_VERSION');
        }
    }
}
