// Licensed to the Apache Software Foundation (ASF) under one
// or more contributor license agreements.  See the NOTICE file
// distributed with this work for additional information
// regarding copyright ownership.  The ASF licenses this file
// to you under the Apache License, Version 2.0 (the
// "License"); you may not use this file except in compliance
// with the License.  You may obtain a copy of the License at
//
//   http://www.apache.org/licenses/LICENSE-2.0
//
// Unless required by applicable law or agreed to in writing,
// software distributed under the License is distributed on an
// "AS IS" BASIS, WITHOUT WARRANTIES OR CONDITIONS OF ANY
// KIND, either express or implied.  See the License for the
// specific language governing permissions and limitations
// under the License.
package com.cloud.api.commands;

import org.apache.log4j.Logger;

import com.cloud.api.ApiConstants;
import com.cloud.api.BaseAsyncCmd;
import com.cloud.api.BaseCmd;
import com.cloud.api.IdentityMapper;
import com.cloud.api.Implementation;
import com.cloud.api.Parameter;
import com.cloud.api.ServerApiException;
import com.cloud.api.response.SuccessResponse;
import com.cloud.event.EventTypes;
import com.cloud.exception.InvalidParameterValueException;
import com.cloud.network.rules.StickinessPolicy;
import com.cloud.network.rules.LoadBalancer;
import com.cloud.user.Account;
import com.cloud.user.UserContext;

@Implementation(description = "Deletes a LB stickiness policy.", responseObject = SuccessResponse.class, since="3.0.0")
public class DeleteLBStickinessPolicyCmd extends BaseAsyncCmd {
    public static final Logger s_logger = Logger.getLogger(DeleteLBStickinessPolicyCmd.class.getName());
    private static final String s_name = "deleteLBstickinessrruleresponse";
    // ///////////////////////////////////////////////////
    // ////////////// API parameters /////////////////////
    // ///////////////////////////////////////////////////

    @IdentityMapper(entityTableName="load_balancer_stickiness_policies")
    @Parameter(name = ApiConstants.ID, type = CommandType.LONG, required = true, description = "the ID of the LB stickiness policy")
    private Long id;

    // ///////////////////////////////////////////////////
    // ///////////////// Accessors ///////////////////////
    // ///////////////////////////////////////////////////

    public Long getId() {
        return id;
    }

    // ///////////////////////////////////////////////////
    // ///////////// API Implementation///////////////////
    // ///////////////////////////////////////////////////

    @Override
    public String getCommandName() {
        return s_name;
    }

    @Override
    public long getEntityOwnerId() {
        Account account = UserContext.current().getCaller();
        if (account != null) {
            return account.getId();
        }

        return Account.ACCOUNT_ID_SYSTEM; // no account info given, parent this command to SYSTEM so ERROR events are tracked
    }

    @Override
    public String getEventType() {
        return EventTypes.EVENT_LB_STICKINESSPOLICY_DELETE;
    }

    @Override
    public String getEventDescription() {
        return "deleting load balancer stickiness policy: " + getId();
    }

    @Override
    public void execute() {
        UserContext.current().setEventDetails("Load balancer stickiness policy Id: " + getId());
        boolean result = _lbService.deleteLBStickinessPolicy(getId(), true);

        if (result) {
            SuccessResponse response = new SuccessResponse(getCommandName());
            this.setResponseObject(response);
        } else {
            throw new ServerApiException(BaseCmd.INTERNAL_ERROR, "Failed to delete load balancer stickiness policy");
        }
    }

    @Override
    public String getSyncObjType() {
        return BaseAsyncCmd.networkSyncObject;
    }

    @Override
    public Long getSyncObjId() {
        StickinessPolicy policy = _entityMgr.findById(StickinessPolicy.class,
                getId());
        if (policy == null) {
            throw new InvalidParameterValueException("Unable to find LB stickiness rule: " + id);        
        }
        LoadBalancer lb = _lbService.findById(policy.getLoadBalancerId());
        if (lb == null) {
            throw new InvalidParameterValueException("Unable to find load balancer rule for stickiness rule: " + id);                 
        }
        return lb.getNetworkId();
    }
}
