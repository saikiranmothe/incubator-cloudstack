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
package com.cloud.network;

import java.util.Date;

import com.cloud.acl.ControlledEntity;

public interface Site2SiteCustomerGateway extends ControlledEntity {
    public long getId();
    public String getGatewayIp();
    public String getGuestCidrList();
    public String getIpsecPsk();
    public String getIkePolicy();
    public String getEspPolicy();
    public Long getIkeLifetime();
    public Long getEspLifetime();
    public Boolean getDpd();
    public Date getRemoved();
    String getName();
}
